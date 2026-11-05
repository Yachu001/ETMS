# backend/tasks/views.py

from datetime import timedelta, datetime, date
from django.utils import timezone
from django.db import models, transaction
from django.core.management import call_command
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q, Avg
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Task, DailyWorkSelection, TaskActivityLog, TaskReasonSubmission
from accounts.audit_service import log_system_event
from notifications.models import Notification
from .serializers import (
    TaskSerializer,
    TaskCreateSerializer,
    TaskActionSerializer,
    DailyCommitmentSerializer,
    TaskActivityLogDetailSerializer,
)
from accounts.models import AttendanceRecord, Department, Business, BusinessDepartment
from accounts.utils import get_subordinate_ids

User = get_user_model()
ACTIVE_WORK_STATUSES = ['ACCEPTED', 'IN_PROGRESS']
ACTIVE_TASK_LIFECYCLE_STATUSES = ['REQUEST_PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION']


def is_task_overdue_for_user(task, user=None):
    if not task.due_date:
        return False
    if task.status in ['VERIFIED', 'REJECTED', 'CANCELLED'] or task.progress_percentage == 100:
        return False

    target_user = user or getattr(task, 'assigned_to', None)
    if target_user and target_user.role in ['ADMIN', 'SUPER_ADMIN']:
        return False

    now = timezone.localtime(timezone.now())
    today = now.date()
    current_time = now.time()

    task_due = task.due_date
    if isinstance(task_due, str):
        try:
            task_due = datetime.strptime(task_due, '%Y-%m-%d').date()
        except ValueError:
            return False

    if today > task_due:
        return True
    elif today == task_due:
        shift_end = getattr(target_user, 'shift_end_time', None)
        if shift_end and current_time >= shift_end:
            return True

    return False


def notify_hierarchy_leaders(task, actor, notification_type, title, message, extra_data=None):
    assignee = task.assigned_to
    direct_parent = getattr(assignee, 'reports_to', None)
    creator = task.created_by
    payload = extra_data or {}

    recipients = set()
    # Notify direct parent
    if direct_parent and direct_parent != actor:
        recipients.add(direct_parent)
    # Notify task creator if different from assignee and parent
    if creator and creator != actor:
        recipients.add(creator)

    for recipient in recipients:
        Notification.objects.create(
            recipient=recipient,
            sender=actor,
            task=task,
            notification_type=notification_type,
            title=title,
            message=message,
            data=payload
        )


# ==========================================
# 1. TASK LIST & CREATE VIEW (SELF VS TEAM SCOPED)
# ==========================================
class TaskListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TaskCreateSerializer
        return TaskSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        user = self.request.user
        queryset = Task.objects.filter(is_disabled=False).select_related(
            'created_by', 'assigned_to', 'assigned_to__matrix', 'assigned_to__business', 'assigned_to__department'
        ).prefetch_related('activity_logs')

        target_user_id = self.request.query_params.get('user_id')
        if target_user_id:
            return queryset.filter(assigned_to_id=target_user_id).order_by('-created_at')

        # Admin and Super Admin never have a self view - strictly team oversight
        if user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser:
            return queryset.exclude(assigned_to=user).order_by('-created_at')

        view_mode = self.request.query_params.get('view_mode', 'self' if user.role == 'EMPLOYEE' else 'team')

        # --- 1. SELF COCKPIT VIEW ---
        # Strictly tasks assigned to current user; terminal states (VERIFIED, REJECTED, CANCELLED) disappear
        if user.role == 'EMPLOYEE' or view_mode == 'self':
            return queryset.filter(
                assigned_to=user,
                status__in=ACTIVE_TASK_LIFECYCLE_STATUSES
            ).order_by('-created_at')

        # --- 2. TEAM VIEW (EXCLUDES SELF TASKS) ---
        if user.role == 'BUSINESS_ADMIN':
            biz = getattr(user, 'effective_business', None) or user.business
            if biz:
                return queryset.filter(
                    Q(assigned_to__business=biz) |
                    Q(assigned_to__matrix__business=biz)
                ).exclude(assigned_to=user).order_by('-created_at')
            return queryset.none()

        elif user.role == 'DEPT_HEAD':
            dept = getattr(user, 'effective_department', None) or user.department
            if dept:
                return queryset.filter(
                    Q(assigned_to__department=dept) |
                    Q(assigned_to__matrix__department=dept)
                ).exclude(assigned_to=user).order_by('-created_at')
            return queryset.none()

        elif user.role == 'SUPERVISOR':
            eff_matrix = getattr(user, 'effective_matrix', None) or user.matrix
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            matrix_member_ids = list(eff_matrix.matrix_members.values_list('id', flat=True)) if eff_matrix else []
            scoped_user_ids = (set(subordinate_ids) | set(matrix_member_ids)) - {user.id}
            return queryset.filter(assigned_to_id__in=scoped_user_ids).order_by('-created_at')

        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        target_assignee = serializer.validated_data.get('assigned_to')

        if target_assignee and target_assignee != user:
            if user.role == 'EMPLOYEE':
                raise PermissionDenied("Base employees can only create self-assigned tasks.")
            elif user.role == 'SUPERVISOR':
                eff_matrix = getattr(user, 'effective_matrix', None) or user.matrix
                subordinate_ids = get_subordinate_ids(user, include_self=True)
                matrix_member_ids = list(eff_matrix.matrix_members.values_list('id', flat=True)) if eff_matrix else []
                if target_assignee.id not in (set(subordinate_ids) | set(matrix_member_ids)):
                    raise PermissionDenied("Supervisors can only assign tasks to their matrix branch members.")
            elif user.role == 'BUSINESS_ADMIN':
                biz = getattr(user, 'effective_business', None) or user.business
                if biz and (target_assignee.business_id != biz.id and getattr(target_assignee.matrix, 'business_id', None) != biz.id):
                    raise PermissionDenied("Business Admins cannot assign tasks outside their business.")
            elif user.role == 'DEPT_HEAD':
                dept = getattr(user, 'effective_department', None) or user.department
                if dept and (target_assignee.department_id != dept.id and getattr(target_assignee.matrix, 'department_id', None) != dept.id):
                    raise PermissionDenied("Department Heads cannot assign tasks outside their department.")

        task = serializer.save(created_by=user)

        if task.assigned_to == user:
            task.status = 'ACCEPTED'
            task.progress_percentage = 0
            task.save(update_fields=['status', 'progress_percentage'])

            TaskActivityLog.objects.create(
                task=task,
                actor=user,
                old_status='REQUEST_PENDING',
                new_status='ACCEPTED',
                old_progress=0,
                new_progress=0,
                remarks="Self-created task automatically accepted (Progress: 0%)."
            )
        else:
            Notification.objects.create(
                recipient=task.assigned_to,
                sender=user,
                task=task,
                notification_type='TASK_ASSIGNED',
                title='New Task Assigned',
                message=f"{user.full_name or user.username} assigned you a new task: '{task.title}'.",
                data={'task_id': task.id, 'priority': task.priority}
            )

        log_system_event(
            actor=user,
            action_type='TASK_CREATED',
            module='TASK',
            target_user=task.assigned_to,
            entity_id=task.id,
            entity_name=task.title,
            new_values={
                'priority': task.priority,
                'status': task.status,
                'due_date': str(task.due_date) if task.due_date else None,
                'assigned_to': task.assigned_to.username if task.assigned_to else None,
                'requires_verification': task.requires_verification,
            },
            remarks=f"Created task '{task.title}' for {task.assigned_to.username if task.assigned_to else 'unassigned'}",
            request=self.request
        )


# ==========================================
# 2. TASK DETAIL VIEW
# ==========================================
class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TaskSerializer

    def get_queryset(self):
        return Task.objects.filter(is_disabled=False).select_related('created_by', 'assigned_to')


# ==========================================
# 3. TASK ACTION VIEW
# ==========================================
class TaskActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        actor = request.user
        action = request.data.get('action', 'UPDATE_PROGRESS')

        subordinate_ids = get_subordinate_ids(actor, include_self=False)
        is_subordinate_task = (task.assigned_to_id in subordinate_ids)
        is_self_task = (task.assigned_to_id == actor.id)

        is_top_authority = (
            actor.role in ['ADMIN', 'SUPER_ADMIN']
            or actor.is_superuser
            or (actor.role in ['BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR'] and is_subordinate_task)
            or (task.created_by == actor and not is_self_task)
        )

        # Cancelled tasks are strictly read-only
        if task.status == 'CANCELLED':
            return Response({'detail': 'This task has been cancelled and is read-only.'}, status=status.HTTP_400_BAD_REQUEST)

        # Authorization guard
        if not is_top_authority and not is_self_task:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        # Strict Task Owner Gating: When acting on own task, actor is treated strictly as assignee
        if is_self_task:
            if task.status == 'AWAITING_VERIFICATION':
                return Response({
                    'detail': 'Task is awaiting verification. You cannot modify it until it is reviewed.'
                }, status=status.HTTP_400_BAD_REQUEST)

            if action == 'UPDATE_PROGRESS' and is_task_overdue_for_user(task, actor):
                return Response({
                    'detail': 'Task is overdue. You must submit an overdue delay explanation form to proceed.'
                }, status=status.HTTP_400_BAD_REQUEST)

        old_status = task.status
        old_progress = task.progress_percentage

        # --- 1. ACCEPT TASK ---
        if action == 'ACCEPT':
            if task.assigned_to != actor:
                raise PermissionDenied("Only the assigned employee can accept this task.")
            if task.status != 'REQUEST_PENDING':
                return Response({'detail': 'Task is not pending acceptance.'}, status=status.HTTP_400_BAD_REQUEST)

            task.status = 'ACCEPTED'
            task.progress_percentage = 0
            task.save(update_fields=['status', 'progress_percentage'])

            if task.created_by and task.created_by != actor:
                Notification.objects.create(
                    recipient=task.created_by,
                    sender=actor,
                    task=task,
                    notification_type='TASK_ACCEPTED',
                    title='Task Assignment Accepted',
                    message=f"{actor.full_name or actor.username} accepted '{task.title}'.",
                    data={'task_id': task.id}
                )

            TaskActivityLog.objects.create(
                task=task,
                actor=actor,
                old_status=old_status,
                new_status=task.status,
                old_progress=0,
                new_progress=0,
                remarks="Task assignment accepted by employee (Progress: 0%)."
            )

            log_system_event(
                actor=actor,
                action_type='TASK_ACCEPTED',
                module='TASK',
                target_user=task.assigned_to,
                entity_id=task.id,
                entity_name=task.title,
                old_values={'status': old_status, 'progress': 0},
                new_values={'status': 'ACCEPTED', 'progress': 0},
                remarks=f"Task assignment accepted for '{task.title}'",
                request=request
            )
            return Response(TaskSerializer(task, context={'request': request}).data)

        # --- 2. REJECT TASK (REASON MANDATORY) ---
        elif action == 'REJECT':
            if task.assigned_to != actor:
                raise PermissionDenied("Only the assigned employee can decline this task.")
            if task.status != 'REQUEST_PENDING':
                return Response({'detail': 'Task is not in pending state.'}, status=status.HTTP_400_BAD_REQUEST)

            rejection_reason = request.data.get('rejection_reason')
            rejection_remarks = request.data.get('rejection_remarks', '').strip()

            if not rejection_reason or not rejection_remarks:
                return Response({'detail': 'A valid rejection reason category and explanation remarks are mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

            task.status = 'REJECTED'
            task.rejection_reason = rejection_reason
            task.rejection_remarks = rejection_remarks
            task.save(update_fields=['status', 'rejection_reason', 'rejection_remarks'])

            reason_display = getattr(task, 'get_rejection_reason_display', lambda: task.rejection_reason)()

            submission = TaskReasonSubmission.objects.create(
                task=task,
                submitted_by=actor,
                routed_to=task.created_by or actor.reports_to,
                form_type='REJECTION',
                reason_category=rejection_reason,
                explanation=rejection_remarks,
                status='PENDING_REVIEW'
            )

            notify_hierarchy_leaders(
                task=task,
                actor=actor,
                notification_type='TASK_REJECTED',
                title='Task Assignment Declined',
                message=f"{actor.full_name or actor.username} declined '{task.title}'. Reason: {reason_display}.",
                extra_data={'task_id': task.id, 'submission_id': submission.id, 'reason': rejection_reason, 'remarks': rejection_remarks}
            )

            TaskActivityLog.objects.create(
                task=task,
                actor=actor,
                old_status=old_status,
                new_status='REJECTED',
                old_progress=task.progress_percentage,
                new_progress=task.progress_percentage,
                remarks=f"Rejected: [{reason_display}] {rejection_remarks}"
            )

            log_system_event(
                actor=actor,
                action_type='TASK_REJECTED',
                module='TASK',
                target_user=task.created_by,
                entity_id=task.id,
                entity_name=task.title,
                old_values={'status': old_status},
                new_values={'status': 'REJECTED', 'reason': rejection_reason, 'remarks': rejection_remarks},
                remarks=f"Rejected task '{task.title}': [{reason_display}] {rejection_remarks}",
                request=request
            )
            return Response(TaskSerializer(task, context={'request': request}).data)

        # --- 3. CANCEL TASK (UPSTREAM LEAD ONLY) ---
        elif action == 'CANCEL':
            if not is_top_authority or is_self_task:
                raise PermissionDenied("Only reporting parents or managers can cancel subordinate tasks.")

            task.status = 'CANCELLED'
            task.save(update_fields=['status'])

            Notification.objects.create(
                recipient=task.assigned_to,
                sender=actor,
                task=task,
                notification_type='REASON_ACTIONED',
                title='Task Cancelled by Lead',
                message=f"Task '{task.title}' was cancelled by {actor.full_name or actor.username}.",
                data={'task_id': task.id, 'action': 'CANCELLED'}
            )

            TaskActivityLog.objects.create(
                task=task,
                actor=actor,
                old_status=old_status,
                new_status='CANCELLED',
                old_progress=task.progress_percentage,
                new_progress=task.progress_percentage,
                remarks=f"Task cancelled by {actor.username}. Assigned user access set to read-only."
            )

            log_system_event(
                actor=actor,
                action_type='TASK_CANCELLED',
                module='TASK',
                target_user=task.assigned_to,
                entity_id=task.id,
                entity_name=task.title,
                old_values={'status': old_status},
                new_values={'status': 'CANCELLED'},
                remarks=f"Cancelled task '{task.title}'",
                request=request
            )
            return Response(TaskSerializer(task, context={'request': request}).data)

        # --- 4. VERIFY TASK (DIRECT OR INDIRECT UPSTREAM PARENT) ---
        elif action == 'VERIFY':
            if not is_top_authority or is_self_task:
                raise PermissionDenied("Only direct or indirect reporting parents can verify this task.")

            task.status = 'VERIFIED'
            task.progress_percentage = 100
            task.verified_by = actor
            task.save(update_fields=['status', 'progress_percentage', 'verified_by'])

            Notification.objects.create(
                recipient=task.assigned_to,
                sender=actor,
                task=task,
                notification_type='TASK_VERIFIED',
                title='Task Verified & Closed',
                message=f"Task '{task.title}' has been reviewed and verified by {actor.full_name or actor.username}.",
                data={'task_id': task.id}
            )

            notify_hierarchy_leaders(
                task=task,
                actor=actor,
                notification_type='TASK_VERIFIED',
                title='Subordinate Task Verified',
                message=f"Task '{task.title}' (Assignee: {task.assigned_to.username}) was verified by {actor.username}.",
                extra_data={'task_id': task.id}
            )

            TaskActivityLog.objects.create(
                task=task,
                actor=actor,
                old_status=old_status,
                new_status='VERIFIED',
                old_progress=old_progress,
                new_progress=100,
                remarks=f"Task verified and closed by {actor.username}."
            )

            log_system_event(
                actor=actor,
                action_type='TASK_VERIFIED',
                module='TASK',
                target_user=task.assigned_to,
                entity_id=task.id,
                entity_name=task.title,
                old_values={'status': old_status, 'progress': old_progress},
                new_values={'status': 'VERIFIED', 'progress': 100},
                remarks=f"Verified task '{task.title}'",
                request=request
            )
            return Response(TaskSerializer(task, context={'request': request}).data)

        # --- 5. UPDATE PROGRESS & LIFECYCLE ---
        requested_status = request.data.get('status')
        new_progress = request.data.get('progress_percentage', task.progress_percentage)
        remarks = request.data.get('remarks', '')

        # Metadata edits (title, description, due date) are allowed for managers on subordinate tasks
        if is_top_authority and not is_self_task:
            if 'due_date' in request.data:
                task.due_date = request.data.get('due_date') or None
            if 'title' in request.data:
                task.title = request.data.get('title')
            if 'description' in request.data:
                task.description = request.data.get('description')

        if requested_status == 'ON_HOLD':
            if task.status not in ['ACCEPTED', 'IN_PROGRESS']:
                return Response({'detail': 'Only accepted or in-progress tasks can be placed on hold.'}, status=status.HTTP_400_BAD_REQUEST)
            new_status = 'ON_HOLD'
        elif task.status == 'ON_HOLD' and requested_status != 'ON_HOLD':
            new_status = 'IN_PROGRESS' if new_progress > 0 else 'ACCEPTED'
        else:
            if new_progress == 0:
                new_status = 'ACCEPTED'
            elif 1 <= new_progress <= 99:
                new_status = 'IN_PROGRESS'
            elif new_progress == 100:
                if task.requires_verification and (is_self_task or not is_top_authority):
                    new_status = 'AWAITING_VERIFICATION'
                    notify_hierarchy_leaders(
                        task=task,
                        actor=actor,
                        notification_type='TASK_SUBMITTED_FOR_VERIFICATION',
                        title='Task Submitted for Verification',
                        message=f"{actor.full_name or actor.username} completed 100% on '{task.title}' and submitted it for verification.",
                        extra_data={'task_id': task.id}
                    )
                else:
                    new_status = 'VERIFIED'
                    if not task.verified_by:
                        task.verified_by = actor
                    notify_hierarchy_leaders(
                        task=task,
                        actor=actor,
                        notification_type='TASK_VERIFIED',
                        title='Task Completed',
                        message=f"{actor.full_name or actor.username} completed '{task.title}'.",
                        extra_data={'task_id': task.id}
                    )
            else:
                new_status = task.status

        task.status = new_status
        task.progress_percentage = new_progress
        task.save()

        today = timezone.localtime(timezone.now()).date()
        DailyWorkSelection.objects.filter(user=actor, task=task, date=today).update(has_status_changed_today=True)

        TaskActivityLog.objects.create(
            task=task,
            actor=actor,
            old_status=old_status,
            new_status=new_status,
            old_progress=old_progress,
            new_progress=new_progress,
            remarks=remarks or f"Progress updated to {new_progress}% ({new_status}) by {actor.username}"
        )

        log_system_event(
            actor=actor,
            action_type='TASK_PROGRESS_UPDATED',
            module='TASK',
            target_user=task.assigned_to,
            entity_id=task.id,
            entity_name=task.title,
            old_values={'status': old_status, 'progress': old_progress},
            new_values={'status': new_status, 'progress': new_progress},
            remarks=f"Updated progress of '{task.title}' to {new_progress}% ({new_status})",
            request=request
        )

        return Response(TaskSerializer(task, context={'request': request}).data)


# ==========================================
# 4. DAILY COMMITMENTS (PLANNER VIEW)
# ==========================================
class DailyCommitmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()

        attendance = AttendanceRecord.objects.filter(user=user, date=today).first()
        is_on_duty = attendance.is_present if attendance else False

        raw_candidates = Task.objects.filter(
            assigned_to=user,
            is_disabled=False,
            status__in=['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD']
        ).exclude(progress_percentage=100).order_by('-created_at')

        eligible_tasks = [t for t in raw_candidates if not is_task_overdue_for_user(t, user)]

        selections = DailyWorkSelection.objects.filter(
            user=user, date=today
        ).select_related('task', 'task__created_by', 'task__assigned_to')

        selected_tasks_payload = []
        for s in selections:
            t = s.task
            selected_tasks_payload.append({
                'id': t.id,
                'selection_id': s.id,
                'title': t.title,
                'description': t.description,
                'priority': t.priority,
                'status': t.status,
                'progress_percentage': t.progress_percentage,
                'requires_verification': t.requires_verification,
                'created_by': t.created_by_id,
                'created_by_name': t.created_by.username if t.created_by else 'Self',
                'assigned_to': t.assigned_to_id,
                'assigned_to_name': t.assigned_to.username if t.assigned_to else '',
                'created_at': t.created_at,
                'due_date': t.due_date,
                'has_status_changed_today': s.has_status_changed_today,
                'is_overdue': is_task_overdue_for_user(t, user),
                'is_committed_today': True,
                'overdue_reason_submitted': t.overdue_reason_submitted,
            })

        active_commitments_count = sum(
            1 for item in selected_tasks_payload
            if item['status'] in ACTIVE_WORK_STATUSES and item['progress_percentage'] < 100
        )

        selected_task_ids = [s.task_id for s in selections]

        return Response({
            'today': today,
            'date': today,
            'is_on_duty': is_on_duty,
            'selected_task_ids': selected_task_ids,
            'selected_tasks': selected_tasks_payload,
            'available_tasks': TaskSerializer(eligible_tasks, many=True, context={'request': request}).data,
            'is_idle': is_on_duty and (active_commitments_count == 0)
        })

    def post(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()

        attendance = AttendanceRecord.objects.filter(user=user, date=today).first()
        if not attendance or not attendance.is_present:
            return Response({
                'detail': 'You must be marked On-Duty / Present today to commit to tasks.'
            }, status=status.HTTP_403_FORBIDDEN)

        task_ids = request.data.get('task_ids', [])

        DailyWorkSelection.objects.filter(user=user, date=today).exclude(task_id__in=task_ids).delete()

        valid_candidates = Task.objects.filter(
            id__in=task_ids,
            assigned_to=user,
            is_disabled=False,
            status__in=['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD']
        ).exclude(progress_percentage=100)

        committed_count = 0
        for task in valid_candidates:
            if is_task_overdue_for_user(task, user):
                continue

            if task.status == 'ON_HOLD':
                task.status = 'IN_PROGRESS'
                task.save(update_fields=['status'])

                TaskActivityLog.objects.create(
                    task=task,
                    actor=user,
                    old_status='ON_HOLD',
                    new_status='IN_PROGRESS',
                    old_progress=task.progress_percentage,
                    new_progress=task.progress_percentage,
                    remarks="Task resumed to In-Progress via daily commitment."
                )

            DailyWorkSelection.objects.get_or_create(user=user, task=task, date=today)
            committed_count += 1

        return Response({'detail': f'Committed {committed_count} tasks for today.'}, status=status.HTTP_200_OK)

    def delete(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()
        task_id = request.data.get('task_id')

        DailyWorkSelection.objects.filter(
            user=user, date=today, task_id=task_id
        ).delete()

        return Response({'detail': 'Task removed from today commitments.'}, status=status.HTTP_200_OK)


# ==========================================
# 5. OVERDUE TASK DELAY REPORT & REASON HUB
# ==========================================
class SubmitTaskDelayReasonView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_disabled=False)
        user = request.user

        if user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins and Super Admins are exempt from delay form submissions.'}, status=status.HTTP_400_BAD_REQUEST)

        if task.assigned_to != user:
            return Response({'detail': 'Only the assigned employee can submit an overdue delay reason.'}, status=status.HTTP_403_FORBIDDEN)

        reason_category = request.data.get('reason_category')
        explanation = request.data.get('explanation', '').strip()
        expected_due_date = request.data.get('expected_due_date') or request.data.get('expected_completion_date')

        if not reason_category or not explanation or not expected_due_date:
            return Response({'detail': 'Reason category, explanation, and expected completion date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localtime(timezone.now()).date()
        try:
            parsed_date = datetime.strptime(str(expected_due_date), '%Y-%m-%d').date()
            if parsed_date < today:
                return Response({'detail': 'Expected completion date must be today or a future date.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({'detail': 'Invalid date format. Expected YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        task.overdue_reason_submitted = True
        task.save(update_fields=['overdue_reason_submitted'])

        routing_target = task.created_by if (task.created_by and task.created_by != user) else user.reports_to

        submission = TaskReasonSubmission.objects.create(
            task=task,
            submitted_by=user,
            routed_to=routing_target,
            form_type='OVERDUE_DELAY',
            reason_category=reason_category,
            explanation=explanation,
            expected_due_date=parsed_date,
            status='PENDING_REVIEW'
        )

        if task.created_by and task.created_by != user:
            Notification.objects.create(
                recipient=task.created_by,
                sender=user,
                task=task,
                notification_type='TASK_OVERDUE',
                title='Overdue Delay Report Submitted',
                message=f"{user.full_name or user.username} submitted an overdue delay report for '{task.title}'. Proposed new due date: {parsed_date}.",
                data={'submission_id': submission.id, 'task_id': task.id, 'type': 'OVERDUE_DELAY'}
            )

        if user.reports_to and user.reports_to != task.created_by:
            Notification.objects.create(
                recipient=user.reports_to,
                sender=user,
                task=task,
                notification_type='TASK_OVERDUE',
                title='Subordinate Overdue Task Delay',
                message=f"{user.full_name or user.username} submitted a delay report on overdue task '{task.title}'.",
                data={'submission_id': submission.id, 'task_id': task.id, 'type': 'OVERDUE_DELAY'}
            )

        TaskActivityLog.objects.create(
            task=task,
            actor=user,
            old_status=task.status,
            new_status=task.status,
            old_progress=task.progress_percentage,
            new_progress=task.progress_percentage,
            remarks=f"Overdue delay reason submitted: [{reason_category}] {explanation}. Expected: {parsed_date}"
        )

        log_system_event(
            actor=user,
            action_type='OVERDUE_DELAY_SUBMITTED',
            module='FORM',
            target_user=task.created_by,
            entity_id=task.id,
            entity_name=task.title,
            new_values={'reason_category': reason_category, 'expected_due_date': str(parsed_date), 'explanation': explanation},
            remarks=f"Overdue delay reason submitted for '{task.title}'. Expected completion: {parsed_date}",
            request=request
        )

        return Response({
            'status': 'success',
            'detail': 'Overdue delay report submitted for authority review.',
            'submission_id': submission.id
        }, status=status.HTTP_201_CREATED)


class AuthorityReasonReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        form_type = request.query_params.get('form_type')
        status_filter = request.query_params.get('status', 'PENDING_REVIEW')

        if user.is_superuser or user.role in ['ADMIN', 'SUPER_ADMIN']:
            qs = TaskReasonSubmission.objects.all()
        elif user.role == 'BUSINESS_ADMIN':
            biz = getattr(user, 'effective_business', None) or user.business
            qs = TaskReasonSubmission.objects.filter(
                Q(submitted_by__business=biz) |
                Q(submitted_by__matrix__business=biz) |
                Q(task__created_by=user) |
                Q(routed_to=user)
            )
        elif user.role == 'DEPT_HEAD':
            dept = getattr(user, 'effective_department', None) or user.department
            qs = TaskReasonSubmission.objects.filter(
                Q(submitted_by__department=dept) |
                Q(submitted_by__matrix__department=dept) |
                Q(task__created_by=user) |
                Q(routed_to=user)
            )
        else:
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            qs = TaskReasonSubmission.objects.filter(
                Q(submitted_by_id__in=subordinate_ids) |
                Q(task__created_by=user) |
                Q(routed_to=user)
            )

        if form_type:
            qs = qs.filter(form_type=form_type)
        if status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        data = []
        for item in qs.select_related('task', 'submitted_by', 'reviewed_by').order_by('-created_at'):
            data.append({
                'id': item.id,
                'task_id': item.task.id,
                'task_title': item.task.title,
                'task_current_progress': item.task.progress_percentage,
                'task_current_status': item.task.status,
                'task_current_due_date': str(item.task.due_date) if item.task.due_date else None,
                'submitted_by_id': item.submitted_by.id,
                'submitted_by_name': item.submitted_by.full_name or item.submitted_by.username,
                'form_type': item.form_type,
                'reason_category': item.reason_category,
                'explanation': item.explanation,
                'expected_due_date': str(item.expected_due_date) if item.expected_due_date else None,
                'status': item.status,
                'reviewed_by_name': (item.reviewed_by.full_name or item.reviewed_by.username) if item.reviewed_by else None,
                'reviewer_remarks': item.reviewer_remarks,
                'actioned_at': item.actioned_at,
                'created_at': item.created_at,
            })

        return Response(data)

    def post(self, request, pk):
        submission = get_object_or_404(TaskReasonSubmission, pk=pk)
        action_type = request.data.get('action')
        reviewer_remarks = request.data.get('remarks', '').strip()
        manager = request.user
        task = submission.task

        subordinate_ids = get_subordinate_ids(manager, include_self=False)
        is_authorized = (
            manager.is_superuser or
            manager.role in ['ADMIN', 'SUPER_ADMIN'] or
            (manager.role in ['BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR'] and submission.submitted_by_id in subordinate_ids) or
            (task.created_by == manager and task.assigned_to != manager) or
            submission.routed_to == manager
        )
        if not is_authorized:
            return Response({'detail': 'Not authorized to review this submission.'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localtime(timezone.now()).date()

        if action_type == 'RESCHEDULE':
            new_due_date = request.data.get('new_due_date') or submission.expected_due_date
            if not new_due_date:
                return Response({'detail': 'A valid future due date is required to reschedule.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                parsed_due_date = datetime.strptime(str(new_due_date), '%Y-%m-%d').date()
                if parsed_due_date < today:
                    return Response({'detail': 'Rescheduled date must be today or a future date.'}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                return Response({'detail': 'Invalid date format. Expected YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

            task.due_date = parsed_due_date
            task.overdue_reason_submitted = False
            if task.status not in ['ACCEPTED', 'IN_PROGRESS', 'REQUEST_PENDING']:
                task.status = 'IN_PROGRESS' if task.progress_percentage > 0 else 'ACCEPTED'
            task.save(update_fields=['due_date', 'overdue_reason_submitted', 'status'])

            submission.status = 'RESCHEDULED'
            submission.reviewed_by = manager
            submission.reviewer_remarks = reviewer_remarks
            submission.actioned_at = timezone.now()
            submission.save()

            Notification.objects.create(
                recipient=task.assigned_to,
                sender=manager,
                task=task,
                notification_type='REASON_ACTIONED',
                title='Task Due Date Rescheduled',
                message=f"Task '{task.title}' is rescheduled by {manager.full_name or manager.username} to {parsed_due_date} as new due date.",
                data={'task_id': task.id, 'action': 'RESCHEDULED', 'new_due_date': str(parsed_due_date)}
            )

            TaskActivityLog.objects.create(
                task=task,
                actor=manager,
                old_status=task.status,
                new_status=task.status,
                old_progress=task.progress_percentage,
                new_progress=task.progress_percentage,
                remarks=f"Due date rescheduled to {parsed_due_date} by {manager.username}. Remarks: {reviewer_remarks}"
            )

            log_system_event(
                actor=manager,
                action_type='REASON_RESCHEDULED',
                module='FORM',
                target_user=task.assigned_to,
                entity_id=task.id,
                entity_name=task.title,
                new_values={'due_date': str(parsed_due_date), 'reviewer_remarks': reviewer_remarks},
                remarks=f"Rescheduled '{task.title}' to {parsed_due_date}",
                request=request
            )

        elif action_type == 'CANCEL':
            old_status = task.status
            task.status = 'CANCELLED'
            task.overdue_reason_submitted = False
            task.save(update_fields=['status', 'overdue_reason_submitted'])

            submission.status = 'CANCELLED'
            submission.reviewed_by = manager
            submission.reviewer_remarks = reviewer_remarks
            submission.actioned_at = timezone.now()
            submission.save()

            Notification.objects.create(
                recipient=task.assigned_to,
                sender=manager,
                task=task,
                notification_type='REASON_ACTIONED',
                title='Task Cancelled',
                message=f"Task '{task.title}' is cancelled by {manager.full_name or manager.username} following delay reason review.",
                data={'task_id': task.id, 'action': 'CANCELLED'}
            )

            TaskActivityLog.objects.create(
                task=task,
                actor=manager,
                old_status=old_status,
                new_status='CANCELLED',
                old_progress=task.progress_percentage,
                new_progress=task.progress_percentage,
                remarks=f"Task cancelled by {manager.username} following overdue delay review. Remarks: {reviewer_remarks}"
            )

            log_system_event(
                actor=manager,
                action_type='REASON_CANCELLED',
                module='FORM',
                target_user=task.assigned_to,
                entity_id=task.id,
                entity_name=task.title,
                old_values={'status': old_status},
                new_values={'status': 'CANCELLED', 'reviewer_remarks': reviewer_remarks},
                remarks=f"Cancelled task '{task.title}' after delay review",
                request=request
            )

        elif action_type in ['VERIFY', 'ACKNOWLEDGE']:
            submission.status = 'VERIFIED'
            submission.reviewed_by = manager
            submission.reviewer_remarks = reviewer_remarks
            submission.actioned_at = timezone.now()
            submission.save()

        return Response({'status': 'success', 'message': f'Submission marked as {submission.status}.'})


# ==========================================
# 6. TEAM OVERVIEW & METRICS (STANDARDIZED FOR ALL MANAGERS)
# ==========================================
class SupervisorTeamOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()

        if user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser:
            subordinates = User.objects.filter(is_active=True).exclude(id=user.id).exclude(role__in=['ADMIN', 'SUPER_ADMIN'])
        elif user.role == 'SUPERVISOR':
            eff_matrix = getattr(user, 'effective_matrix', None) or user.matrix
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            matrix_member_ids = list(eff_matrix.matrix_members.filter(is_active=True).values_list('id', flat=True)) if eff_matrix else []
            combined_ids = (set(subordinate_ids) | set(matrix_member_ids)) - {user.id}
            subordinates = User.objects.filter(id__in=combined_ids, is_active=True)
        elif user.role in ['BUSINESS_ADMIN', 'DEPT_HEAD']:
            biz = getattr(user, 'effective_business', None) or user.business
            dept = getattr(user, 'effective_department', None) or user.department
            if user.role == 'BUSINESS_ADMIN' and biz:
                subordinates = User.objects.filter(
                    Q(business=biz) | Q(matrix__business=biz), is_active=True
                ).exclude(id=user.id).exclude(role__in=['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN'])
            elif user.role == 'DEPT_HEAD' and dept:
                subordinates = User.objects.filter(
                    Q(department=dept) | Q(matrix__department=dept), is_active=True
                ).exclude(id=user.id).exclude(role__in=['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD'])
            else:
                subordinates = User.objects.none()
        else:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        subordinates = subordinates.select_related('department', 'matrix', 'matrix__department', 'business')
        subordinate_list = list(subordinates)
        subordinate_ids = [s.id for s in subordinate_list]

        present_user_ids = set(
            AttendanceRecord.objects.filter(
                user_id__in=subordinate_ids, date=today, is_present=True
            ).values_list('user_id', flat=True)
        )

        today_commitments = DailyWorkSelection.objects.filter(
            user_id__in=subordinate_ids, date=today
        ).select_related('task')

        commitments_by_user = {}
        for c in today_commitments:
            commitments_by_user.setdefault(c.user_id, []).append(c)

        team_rows = []
        for emp in subordinate_list:
            is_present = emp.id in present_user_ids
            emp_commitments = commitments_by_user.get(emp.id, [])
            
            # Individual user's active commits count
            active_committed = [
                c for c in emp_commitments 
                if c.task.status in ACTIVE_WORK_STATUSES and c.task.progress_percentage < 100
            ]
            committed_count = len(active_committed)
            is_idle = is_present and (committed_count == 0)

            active_tasks_count = Task.objects.filter(
                assigned_to=emp, is_disabled=False, status__in=ACTIVE_WORK_STATUSES
            ).count()

            dept_obj = emp.department or (emp.matrix.department if getattr(emp, 'matrix', None) else None)
            primary_dept_name = dept_obj.name if dept_obj else 'General'

            primary_task_title = (
                emp_commitments[0].task.title if emp_commitments
                else ('On Leave' if not is_present else 'None Marked Today')
            )

            team_rows.append({
                'id': emp.id,
                'username': emp.username,
                'name': emp.full_name or emp.username,
                'role': emp.role,
                'designation': getattr(emp, 'designation', '') or 'Staff',
                'department': primary_dept_name,
                'matrix_title': str(emp.matrix) if emp.matrix else 'No Matrix',
                'is_present': is_present,
                'active_daily_tasks': committed_count,
                'active_tasks_count': active_tasks_count,
                'commits_ratio': f"{committed_count} / {active_tasks_count}",
                'is_idle': is_idle,
                'load_status': 'ON_LEAVE' if not is_present else ('IDLE' if is_idle else 'ACTIVE'),
                'primary_task_title': primary_task_title
            })

        total_team = len(team_rows)
        present_count = len(present_user_ids)
        working_count = len([r for r in team_rows if r['load_status'] == 'ACTIVE'])
        idle_count = max(0, present_count - working_count)

        total_team_active_tasks = Task.objects.filter(
            assigned_to_id__in=subordinate_ids, is_disabled=False, status__in=ACTIVE_WORK_STATUSES
        ).count()

        total_team_daily_commits = DailyWorkSelection.objects.filter(
            user_id__in=subordinate_ids,
            date=today,
            task__status__in=ACTIVE_WORK_STATUSES,
            task__is_disabled=False
        ).exclude(task__progress_percentage=100).count()

        return Response({
            'total_team': total_team,
            'present_count': present_count,
            'on_leave_count': total_team - present_count,
            'committed_count': working_count,
            'idle_count': idle_count,
            'total_active_tasks': total_team_active_tasks,
            'total_daily_commits': total_team_daily_commits,
            'daily_commits_ratio': f"{total_team_daily_commits} / {total_team_active_tasks}",
            'members': team_rows
        })


class TeamIdleRosterView(APIView):
    """
    Table 1 on Overview:
    Lists active + present subordinates who have 0 active committed tasks today.
    Scoped strictly by reporting structure.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()

        if user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser:
            scope_users = User.objects.filter(is_active=True).exclude(role__in=['ADMIN', 'SUPER_ADMIN'])
        elif user.role == 'SUPERVISOR':
            eff_matrix = getattr(user, 'effective_matrix', None) or user.matrix
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            matrix_member_ids = list(eff_matrix.matrix_members.filter(is_active=True).values_list('id', flat=True)) if eff_matrix else []
            combined_ids = (set(subordinate_ids) | set(matrix_member_ids)) - {user.id}
            scope_users = User.objects.filter(id__in=combined_ids, is_active=True)
        elif user.role in ['BUSINESS_ADMIN', 'DEPT_HEAD']:
            biz = getattr(user, 'effective_business', None) or user.business
            dept = getattr(user, 'effective_department', None) or user.department
            if user.role == 'BUSINESS_ADMIN' and biz:
                scope_users = User.objects.filter(
                    Q(business=biz) | Q(matrix__business=biz), is_active=True
                ).exclude(role__in=['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN'])
            elif user.role == 'DEPT_HEAD' and dept:
                scope_users = User.objects.filter(
                    Q(department=dept) | Q(matrix__department=dept), is_active=True
                ).exclude(role__in=['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD'])
            else:
                scope_users = User.objects.none()
        else:
            return Response([])

        scope_users = list(scope_users.select_related('department', 'matrix', 'business'))
        user_ids = [u.id for u in scope_users]

        present_user_ids = set(
            AttendanceRecord.objects.filter(
                user_id__in=user_ids, date=today, is_present=True
            ).values_list('user_id', flat=True)
        )

        active_committed_user_ids = set(
            DailyWorkSelection.objects.filter(
                user_id__in=user_ids,
                date=today,
                task__status__in=ACTIVE_WORK_STATUSES,
                task__is_disabled=False
            ).exclude(task__progress_percentage=100).values_list('user_id', flat=True)
        )

        idle_members = []
        for u in scope_users:
            if u.id in present_user_ids and u.id not in active_committed_user_ids:
                active_backlog_tasks = Task.objects.filter(
                    assigned_to=u, is_disabled=False, status__in=ACTIVE_WORK_STATUSES
                ).count()

                idle_members.append({
                    'id': u.id,
                    'username': u.username,
                    'name': u.full_name or u.username,
                    'role': u.role,
                    'designation': getattr(u, 'designation', 'Staff') or 'Staff',
                    'matrix_title': str(u.matrix) if u.matrix else 'No Matrix',
                    'is_active': True,
                    'is_present': True,
                    'has_active_commits': False,
                    'active_tasks_count': active_backlog_tasks,
                    'daily_commits_count': 0
                })

        return Response(idle_members)


class TeamOverdueTasksView(APIView):
    """
    Table 2 on Overview:
    Lists overdue tasks of team members with submission review status.
    Scoped strictly by reporting structure.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        queryset = Task.objects.filter(is_disabled=False).select_related(
            'assigned_to', 'created_by', 'assigned_to__matrix', 'assigned_to__department'
        ).exclude(status__in=['VERIFIED', 'REJECTED', 'CANCELLED']).exclude(progress_percentage=100)

        if user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser:
            qs = queryset.exclude(assigned_to=user)
        elif user.role == 'BUSINESS_ADMIN':
            biz = getattr(user, 'effective_business', None) or user.business
            qs = queryset.filter(Q(assigned_to__business=biz) | Q(assigned_to__matrix__business=biz)).exclude(assigned_to=user)
        elif user.role == 'DEPT_HEAD':
            dept = getattr(user, 'effective_department', None) or user.department
            qs = queryset.filter(Q(assigned_to__department=dept) | Q(assigned_to__matrix__department=dept)).exclude(assigned_to=user)
        elif user.role == 'SUPERVISOR':
            eff_matrix = getattr(user, 'effective_matrix', None) or user.matrix
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            matrix_member_ids = list(eff_matrix.matrix_members.values_list('id', flat=True)) if eff_matrix else []
            scoped_user_ids = (set(subordinate_ids) | set(matrix_member_ids)) - {user.id}
            qs = queryset.filter(assigned_to_id__in=scoped_user_ids)
        else:
            return Response([])

        overdue_tasks = []
        for t in qs.order_by('-due_date'):
            if is_task_overdue_for_user(t):
                submission = TaskReasonSubmission.objects.filter(
                    task=t, form_type='OVERDUE_DELAY', status='PENDING_REVIEW'
                ).first()

                overdue_tasks.append({
                    'id': t.id,
                    'title': t.title,
                    'priority': t.priority,
                    'status': t.status,
                    'progress_percentage': t.progress_percentage,
                    'due_date': str(t.due_date) if t.due_date else None,
                    'assigned_to_id': t.assigned_to_id,
                    'assigned_to_name': t.assigned_to.full_name or t.assigned_to.username,
                    'assigned_to_role': t.assigned_to.role,
                    'assigned_to_designation': getattr(t.assigned_to, 'designation', 'Staff') or 'Staff',
                    'overdue_reason_submitted': t.overdue_reason_submitted,
                    'submission_id': submission.id if submission else None,
                    'reason_category': submission.reason_category if submission else None,
                    'expected_due_date': str(submission.expected_due_date) if submission and submission.expected_due_date else None,
                    'explanation': submission.explanation if submission else '',
                })

        return Response(overdue_tasks)


# ==========================================
# 7. MATRIX DRILL-DOWN OVERVIEW (WITH 3-DOT WORK STATS)
# ==========================================
class MatrixOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()

        biz = getattr(user, 'effective_business', None) or user.business
        dept = getattr(user, 'effective_department', None) or user.department

        matrix_qs = BusinessDepartment.objects.filter(is_active=True).select_related(
            'business', 'department', 'supervisor', 'created_by'
        )

        if user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser:
            pass
        elif user.role == 'BUSINESS_ADMIN' and biz:
            matrix_qs = matrix_qs.filter(business=biz)
        elif user.role == 'DEPT_HEAD' and dept:
            matrix_qs = matrix_qs.filter(department=dept)
        elif user.role == 'SUPERVISOR':
            eff_matrix = getattr(user, 'effective_matrix', None) or user.matrix
            if eff_matrix:
                matrix_qs = matrix_qs.filter(id=eff_matrix.id)
            else:
                return Response([])
        else:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        results = []
        for m in matrix_qs:
            lead = m.effective_incharge
            raw_members = list(m.matrix_members.filter(is_active=True))

            # Helper to calculate individual user commitments (isolating supervisor dot from team)
            def build_user_row(target_user, is_sup):
                is_pres = AttendanceRecord.objects.filter(user=target_user, date=today, is_present=True).exists()
                user_daily_commits = DailyWorkSelection.objects.filter(
                    user=target_user,
                    date=today,
                    task__status__in=ACTIVE_WORK_STATUSES,
                    task__is_disabled=False
                ).exclude(task__progress_percentage=100).count()
                user_active_tasks = Task.objects.filter(
                    assigned_to=target_user, is_disabled=False, status__in=ACTIVE_WORK_STATUSES
                ).count()

                return {
                    'id': target_user.id,
                    'username': target_user.username,
                    'name': target_user.full_name or target_user.username,
                    'role': target_user.role,
                    'designation': getattr(target_user, 'designation', 'Matrix Supervisor' if is_sup else 'Staff') or 'Staff',
                    'is_supervisor': is_sup,
                    'is_active': target_user.is_active,
                    'is_present': is_pres,
                    'daily_commits_count': user_daily_commits,
                    'active_tasks_count': user_active_tasks,
                    'has_active_commits': user_daily_commits > 0,
                    'commits_ratio': f"{user_daily_commits} / {user_active_tasks}"
                }

            combined_users = []
            if lead and lead.is_active:
                combined_users.append(build_user_row(lead, is_sup=True))

            for mem in raw_members:
                if lead and mem.id == lead.id:
                    continue
                combined_users.append(build_user_row(mem, is_sup=False))

            member_ids = [u['id'] for u in combined_users]
            present_ids = {u['id'] for u in combined_users if u['is_present']}
            committed_ids = {u['id'] for u in combined_users if u['daily_commits_count'] > 0}

            matrix_overdues = 0
            for t in Task.objects.filter(assigned_to_id__in=member_ids, is_disabled=False):
                if is_task_overdue_for_user(t):
                    matrix_overdues += 1

            total_active_tasks = Task.objects.filter(
                assigned_to_id__in=member_ids, is_disabled=False, status__in=ACTIVE_WORK_STATUSES
            ).count()

            results.append({
                'id': m.id,
                'name': m.name or f"{m.business.code} - {m.department.name}",
                'code': m.code or f"{m.business.code}-{m.department.code}",
                'business_id': m.business.id,
                'business_name': m.business.name,
                'department_id': m.department.id,
                'department_name': m.department.name,
                'supervisor_id': lead.id if lead else None,
                'supervisor_name': (lead.full_name or lead.username) if lead else 'Unassigned',
                'total_members': len(combined_users),
                'present_count': len(present_ids),
                'daily_commits_count': len(committed_ids.intersection(present_ids)),
                'total_active_tasks': total_active_tasks,
                'overdues_count': matrix_overdues,
                'idle_count': max(0, len(present_ids) - len(committed_ids.intersection(present_ids))),
                'roster': combined_users
            })

        return Response(results)


# ==========================================
# 8. ADMIN DASHBOARDS & SUMMARY
# ==========================================
class AdminRootTablesSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser):
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localtime(timezone.now()).date()

        # Tab 1: Businesses
        businesses = Business.objects.all()
        biz_data = []
        for b in businesses:
            b_users = User.objects.filter(Q(business=b) | Q(matrix__business=b), is_active=True)
            u_ids = list(b_users.values_list('id', flat=True))
            present_uids = set(AttendanceRecord.objects.filter(user_id__in=u_ids, date=today, is_present=True).values_list('user_id', flat=True))
            committed_uids = set(DailyWorkSelection.objects.filter(user_id__in=u_ids, date=today, task__status__in=ACTIVE_WORK_STATUSES).exclude(task__progress_percentage=100).values_list('user_id', flat=True))
            
            overdue_count = 0
            for t in Task.objects.filter(assigned_to_id__in=u_ids, is_disabled=False):
                if is_task_overdue_for_user(t):
                    overdue_count += 1

            biz_data.append({
                'id': b.id,
                'name': b.name,
                'code': b.code,
                'present_active_members': f"{len(present_uids)} / {len(u_ids)}",
                'daily_commits_active_tasks': f"{len(committed_uids)} / {Task.objects.filter(assigned_to__in=b_users, status__in=ACTIVE_WORK_STATUSES, is_disabled=False).count()}",
                'overdues_count': overdue_count,
                'idle_user_count': max(0, len(present_uids) - len(committed_uids.intersection(present_uids)))
            })

        # Tab 2: Departments
        departments = Department.objects.all()
        dept_data = []
        for d in departments:
            d_users = User.objects.filter(Q(department=d) | Q(matrix__department=d), is_active=True)
            u_ids = list(d_users.values_list('id', flat=True))
            present_uids = set(AttendanceRecord.objects.filter(user_id__in=u_ids, date=today, is_present=True).values_list('user_id', flat=True))
            committed_uids = set(DailyWorkSelection.objects.filter(user_id__in=u_ids, date=today, task__status__in=ACTIVE_WORK_STATUSES).exclude(task__progress_percentage=100).values_list('user_id', flat=True))

            overdue_count = 0
            for t in Task.objects.filter(assigned_to_id__in=u_ids, is_disabled=False):
                if is_task_overdue_for_user(t):
                    overdue_count += 1

            dept_data.append({
                'id': d.id,
                'name': d.name,
                'code': d.code,
                'present_active_members': f"{len(present_uids)} / {len(u_ids)}",
                'daily_commits_active_tasks': f"{len(committed_uids)} / {Task.objects.filter(assigned_to__in=d_users, status__in=ACTIVE_WORK_STATUSES, is_disabled=False).count()}",
                'overdues_count': overdue_count,
                'idle_user_count': max(0, len(present_uids) - len(committed_uids.intersection(present_uids)))
            })

        # Tab 3: Business Admins Roster
        bus_admins = User.objects.filter(role='BUSINESS_ADMIN', is_active=True).select_related('business')
        bus_admins_data = []
        for ba in bus_admins:
            ba_present = AttendanceRecord.objects.filter(user=ba, date=today, is_present=True).exists()
            ba_active_commits = DailyWorkSelection.objects.filter(user=ba, date=today, task__status__in=ACTIVE_WORK_STATUSES).exclude(task__progress_percentage=100).count()
            ba_active_tasks = Task.objects.filter(assigned_to=ba, status__in=ACTIVE_WORK_STATUSES, is_disabled=False).count()
            ba_overdue = sum(1 for t in Task.objects.filter(assigned_to=ba, is_disabled=False) if is_task_overdue_for_user(t, ba))
            ba_idle = ba_present and (ba_active_commits == 0)

            bus_admins_data.append({
                'id': ba.id,
                'name': ba.full_name or ba.username,
                'role': ba.role,
                'business_name': ba.business.name if ba.business else 'General',
                'is_active': True,
                'is_present': ba_present,
                'is_idle': ba_idle,
                'daily_commits': ba_active_commits,
                'active_tasks': ba_active_tasks,
                'commits_ratio': f"{ba_active_commits} / {ba_active_tasks}",
                'overdues_count': ba_overdue,
            })

        # Tab 4: Department Admins Roster
        dept_admins = User.objects.filter(role='DEPT_HEAD', is_active=True).select_related('department')
        dept_admins_data = []
        for da in dept_admins:
            da_present = AttendanceRecord.objects.filter(user=da, date=today, is_present=True).exists()
            da_active_commits = DailyWorkSelection.objects.filter(user=da, date=today, task__status__in=ACTIVE_WORK_STATUSES).exclude(task__progress_percentage=100).count()
            da_active_tasks = Task.objects.filter(assigned_to=da, status__in=ACTIVE_WORK_STATUSES, is_disabled=False).count()
            da_overdue = sum(1 for t in Task.objects.filter(assigned_to=da, is_disabled=False) if is_task_overdue_for_user(t, da))
            da_idle = da_present and (da_active_commits == 0)

            dept_admins_data.append({
                'id': da.id,
                'name': da.full_name or da.username,
                'role': da.role,
                'department_name': da.department.name if da.department else 'General',
                'is_active': True,
                'is_present': da_present,
                'is_idle': da_idle,
                'daily_commits': da_active_commits,
                'active_tasks': da_active_tasks,
                'commits_ratio': f"{da_active_commits} / {da_active_tasks}",
                'overdues_count': da_overdue,
            })

        return Response({
            'businesses': biz_data,
            'departments': dept_data,
            'business_admins': bus_admins_data,
            'dept_admins': dept_admins_data
        })


class AdminDepartmentsSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['ADMIN', 'SUPER_ADMIN'] and not request.user.is_superuser:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localtime(timezone.now()).date()
        departments = Department.objects.prefetch_related('department_users').all()
        dept_data = []

        for dept in departments:
            users = [u for u in dept.department_users.all() if u.is_active]
            total_users = len(users)
            user_ids = [u.id for u in users]

            present_user_ids = set(
                AttendanceRecord.objects.filter(
                    user_id__in=user_ids, date=today, is_present=True
                ).values_list('user_id', flat=True)
            )

            committed_user_ids = set(
                DailyWorkSelection.objects.filter(
                    user_id__in=user_ids, 
                    date=today,
                    task__status__in=ACTIVE_WORK_STATUSES
                ).exclude(task__progress_percentage=100).values_list('user_id', flat=True)
            )

            present_count = len(present_user_ids)
            working_count = len(committed_user_ids.intersection(present_user_ids))
            idle_count = max(0, present_count - working_count)

            dept_tasks = Task.objects.filter(assigned_to_id__in=user_ids, is_disabled=False)
            avg_progress = dept_tasks.aggregate(avg=Avg('progress_percentage'))['avg'] or 0.0

            dept_data.append({
                'id': dept.id,
                'name': dept.name,
                'total_users': total_users,
                'present_users': present_count,
                'on_leave_users': total_users - present_count,
                'committed_users': working_count,
                'idle_users_count': idle_count,
                'has_zero_idle': (idle_count == 0 and present_count > 0),
                'active_tasks_count': DailyWorkSelection.objects.filter(user_id__in=user_ids, date=today).count(),
                'avg_progress': round(avg_progress, 1),
            })

        return Response(dept_data)


# ==========================================
# 9. TASK AUDIT LOG LIST & METADATA VIEW
# ==========================================
class AuditLogMetaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localtime(timezone.now()).date()
        oldest_record = TaskActivityLog.objects.order_by('timestamp').first()

        if oldest_record and oldest_record.timestamp:
            earliest_date = oldest_record.timestamp.date()
            available_days = max((today - earliest_date).days + 1, 1)
        else:
            earliest_date = today
            available_days = 1

        return Response({
            'today': str(today),
            'earliest_log_date': str(earliest_date),
            'max_available_days': available_days
        })


class TaskAuditLogListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        queryset = TaskActivityLog.objects.select_related(
            'task', 'actor', 'task__assigned_to', 'task__created_by'
        ).all()

        if user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser:
            pass
        elif user.role == 'SUPERVISOR':
            subordinate_ids = get_subordinate_ids(user, include_self=True)
            queryset = queryset.filter(
                Q(task__assigned_to_id__in=subordinate_ids) |
                Q(task__created_by_id__in=subordinate_ids)
            )
        else:
            queryset = queryset.filter(
                Q(task__assigned_to=user) | Q(task__created_by=user)
            )

        task_id = request.query_params.get('task_id')
        if task_id:
            queryset = queryset.filter(task_id=task_id)

        actor_name = request.query_params.get('actor')
        if actor_name:
            queryset = queryset.filter(actor__username__icontains=actor_name)

        status_type = request.query_params.get('status')
        if status_type:
            queryset = queryset.filter(new_status=status_type)

        days_param = request.query_params.get('days')
        now = timezone.now()
        if days_param and days_param.isdigit():
            retention_days = max(int(days_param), 1)
            cutoff_date = now - timedelta(days=retention_days)
            queryset = queryset.filter(timestamp__gte=cutoff_date)
        else:
            queryset = queryset.filter(timestamp__gte=now - timedelta(days=30))

        queryset = queryset.order_by('-timestamp')

        page_size_param = request.query_params.get('page_size', '100')
        page_size = int(page_size_param) if page_size_param in ['25', '50', '100'] else 100
        page_num = request.query_params.get('page', 1)

        paginator = Paginator(queryset, page_size)
        try:
            page_obj = paginator.page(page_num)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

        serializer = TaskActivityLogDetailSerializer(page_obj.object_list, many=True)
        return Response({
            'count': paginator.count,
            'num_pages': paginator.num_pages,
            'current_page': page_obj.number,
            'page_size': page_size,
            'results': serializer.data
        })


# ==========================================
# 10. COMMITMENT NO-ACTION REASON
# ==========================================
class SubmitCommitmentNoActionReasonView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_disabled=False)
        user = request.user

        if user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins and Super Admins are exempt from daily inaction submissions.'}, status=status.HTTP_400_BAD_REQUEST)

        if task.assigned_to != user:
            return Response({'detail': 'Only the assigned employee can submit a reason for this task.'}, status=status.HTTP_403_FORBIDDEN)

        reason_category = request.data.get('reason_category')
        explanation = request.data.get('explanation', '').strip()

        if not reason_category or not explanation:
            return Response({'detail': 'Reason category and explanation are required.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localtime(timezone.now()).date()
        routing_target = task.created_by if (task.created_by and task.created_by != user) else user.reports_to

        submission = TaskReasonSubmission.objects.create(
            task=task,
            submitted_by=user,
            routed_to=routing_target,
            form_type='NO_ACTION_TODAY',
            reason_category=reason_category,
            explanation=explanation,
            status='PENDING_REVIEW'
        )

        DailyWorkSelection.objects.filter(
            user=user, task=task, date=today
        ).update(has_status_changed_today=True)

        if task.created_by and task.created_by != user:
            Notification.objects.create(
                recipient=task.created_by,
                sender=user,
                task=task,
                notification_type='REASON_SUBMITTED',
                title='Committed Task No-Action Explanation',
                message=f"{user.full_name or user.username} submitted an explanation for lack of activity on '{task.title}' today.",
                data={'submission_id': submission.id, 'task_id': task.id, 'type': 'NO_ACTION_TODAY'}
            )

        if user.reports_to and user.reports_to != task.created_by:
            Notification.objects.create(
                recipient=user.reports_to,
                sender=user,
                task=task,
                notification_type='REASON_SUBMITTED',
                title='Subordinate Daily Inaction Reason',
                message=f"{user.full_name or user.username} reported a reason for no activity today on '{task.title}'.",
                data={'submission_id': submission.id, 'task_id': task.id, 'type': 'NO_ACTION_TODAY'}
            )

        TaskActivityLog.objects.create(
            task=task,
            actor=user,
            old_status=task.status,
            new_status=task.status,
            old_progress=task.progress_percentage,
            new_progress=task.progress_percentage,
            remarks=f"Daily commit no-action explanation submitted: [{reason_category}] {explanation}"
        )

        log_system_event(
            actor=user,
            action_type='NO_ACTION_TODAY_SUBMITTED',
            module='FORM',
            target_user=task.created_by,
            entity_id=task.id,
            entity_name=task.title,
            new_values={'reason_category': reason_category, 'explanation': explanation},
            remarks=f"Submitted inaction explanation for '{task.title}': [{reason_category}] {explanation}",
            request=request
        )

        return Response({
            'status': 'success',
            'detail': 'Daily no-action explanation submitted.',
            'submission_id': submission.id
        }, status=status.HTTP_201_CREATED)


# ==========================================
# 11. IDLE MONITORING STATUS
# ==========================================
class IdleMonitoringStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.localtime(timezone.now())
        today = now.date()
        current_time = now.time()

        attendance = AttendanceRecord.objects.filter(user=user, date=today).first()
        is_present = attendance.is_present if attendance else False

        active_commitments_count = DailyWorkSelection.objects.filter(
            user=user,
            date=today,
            task__status__in=['ACCEPTED', 'IN_PROGRESS'],
            task__is_disabled=False
        ).exclude(task__progress_percentage=100).count()

        is_self_idle = is_present and (active_commitments_count == 0)

        self_timer_start = getattr(user, 'self_idle_timer_start', None)
        self_threshold_reached = False
        if self_timer_start and current_time >= self_timer_start:
            self_threshold_reached = True

        if is_self_idle and self_threshold_reached and user.role not in ['ADMIN', 'SUPER_ADMIN']:
            recent_self_alert = Notification.objects.filter(
                recipient=user,
                notification_type='IDLE_ALERT',
                created_at__gte=now - timedelta(minutes=30)
            ).exists()

            if not recent_self_alert:
                Notification.objects.create(
                    recipient=user,
                    sender=None,
                    notification_type='IDLE_ALERT',
                    title='Idle Alert: No Active Work Committed',
                    message='You are on-duty but currently have 0 active tasks committed for today. Please update or commit new tasks.',
                    data={'type': 'SELF_IDLE'}
                )

        team_idle_summary = []
        is_manager = user.role in ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'] or user.is_superuser

        if is_manager:
            team_timer_start = getattr(user, 'team_idle_timer_start', None) or getattr(user, 'self_idle_timer_start', None)
            team_threshold_reached = team_timer_start and (current_time >= team_timer_start)

            subordinate_ids = get_subordinate_ids(user, include_self=False)
            present_subordinates = AttendanceRecord.objects.filter(
                user_id__in=subordinate_ids,
                date=today,
                is_present=True
            ).values_list('user_id', flat=True)

            for sub_id in present_subordinates:
                sub_user = User.objects.filter(id=sub_id).first()
                if not sub_user or not sub_user.is_active or sub_user.role in ['ADMIN', 'SUPER_ADMIN']:
                    continue

                sub_active_count = DailyWorkSelection.objects.filter(
                    user=sub_user,
                    date=today,
                    task__status__in=['ACCEPTED', 'IN_PROGRESS'],
                    task__is_disabled=False
                ).exclude(task__progress_percentage=100).count()

                if sub_active_count == 0:
                    team_idle_summary.append({
                        'id': sub_user.id,
                        'username': sub_user.username,
                        'name': sub_user.full_name or sub_user.username,
                    })

                    if team_threshold_reached:
                        recent_team_alert = Notification.objects.filter(
                            recipient=user,
                            notification_type='IDLE_ALERT',
                            data__user_id=sub_user.id,
                            created_at__gte=now - timedelta(minutes=45)
                        ).exists()

                        if not recent_team_alert:
                            Notification.objects.create(
                                recipient=user,
                                sender=None,
                                notification_type='IDLE_ALERT',
                                title=f"Subordinate Idle Alert: {sub_user.full_name or sub_user.username}",
                                message=f"{sub_user.full_name or sub_user.username} has been on-duty with no active tasks committed.",
                                data={'type': 'TEAM_IDLE', 'user_id': sub_user.id}
                            )

        return Response({
            'is_present': is_present,
            'is_self_idle': is_self_idle,
            'active_commitments_count': active_commitments_count,
            'self_timer_start': str(self_timer_start) if self_timer_start else '10:00:00',
            'team_timer_start': str(getattr(user, 'team_idle_timer_start', '')) if is_manager else None,
            'team_idle_members': team_idle_summary,
            'timestamp': now
        })


# ==========================================
# 12. MANUAL MIDNIGHT SWEEP
# ==========================================
class TriggerManualMidnightSweepView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not (request.user.role in ['ADMIN', 'SUPER_ADMIN'] or request.user.is_superuser):
            return Response({'detail': 'Only Admins can manually invoke the inaction sweep.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            call_command('sweep_daily_inaction')
            return Response({'status': 'success', 'message': 'Midnight inaction sweep executed successfully.'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)