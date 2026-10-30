# backend/tasks/views.py

from datetime import timedelta, datetime, date
from django.utils import timezone
from django.db import models
from django.core.management import call_command
from django.db.models import Q, Avg
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Task, DailyWorkSelection, TaskActivityLog, TaskReasonSubmission
from notifications.models import Notification
from .serializers import (
    TaskSerializer,
    TaskCreateSerializer,
    TaskActionSerializer,
    DailyCommitmentSerializer,
    TaskActivityLogDetailSerializer,
)
from accounts.models import AttendanceRecord, Department
from accounts.utils import get_subordinate_ids

User = get_user_model()
ACTIVE_WORK_STATUSES = ['ACCEPTED', 'IN_PROGRESS']


def is_task_overdue_for_user(task, user=None):
    """
    Evaluates whether a task is overdue based on date and user shift end time:
    - If task has no due_date -> False
    - If status is terminal (VERIFIED, REJECTED, CANCELLED) or progress == 100 -> False
    - If today > due_date -> True (Past date is ALWAYS overdue)
    - If today == due_date:
        - If current_time >= user.shift_end_time -> True
        - Otherwise -> False
    - If today < due_date -> False
    """
    if not task.due_date:
        return False
    if task.status in ['VERIFIED', 'REJECTED', 'CANCELLED'] or task.progress_percentage == 100:
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
        shift_end = getattr(user, 'shift_end_time', None)
        if shift_end and current_time >= shift_end:
            return True

    return False


# ==========================================
# 1. TASK LIST & CREATE VIEW (SCOPED)
# ==========================================
class TaskListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TaskCreateSerializer
        return TaskSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Task.objects.filter(is_disabled=False).select_related(
            'created_by', 'assigned_to'
        ).prefetch_related('activity_logs')

        target_user_id = self.request.query_params.get('user_id')
        if target_user_id:
            return queryset.filter(assigned_to_id=target_user_id).order_by('-created_at')

        # Base Employee: only assigned or created, exclude terminal states
        if user.role == 'EMPLOYEE':
            return queryset.filter(
                Q(assigned_to=user) | Q(created_by=user)
            ).exclude(
                status__in=['VERIFIED', 'REJECTED', 'CANCELLED']
            ).order_by('-created_at')

        # Supervisor: self + subordinate tree
        elif user.role == 'SUPERVISOR':
            subordinate_ids = get_subordinate_ids(user, include_self=True)
            return queryset.filter(
                Q(assigned_to_id__in=subordinate_ids) | Q(created_by=user)
            ).order_by('-created_at')

        # Admin / Executive
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
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
                remarks="Self-created task automatically accepted (Not Started)."
            )
        else:
            # Issue assignment notification to recipient
            Notification.objects.create(
                recipient=task.assigned_to,
                sender=user,
                task=task,
                notification_type='TASK_ASSIGNED',
                title='New Task Assigned',
                message=f"{user.full_name or user.username} assigned you a new task: '{task.title}'.",
                data={'task_id': task.id, 'priority': task.priority}
            )


# ==========================================
# 2. TASK DETAIL VIEW
# ==========================================
class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TaskSerializer

    def get_queryset(self):
        return Task.objects.filter(is_disabled=False).select_related(
            'created_by', 'assigned_to'
        )


# ==========================================
# 3. TASK ACTION VIEW (ACCEPT, REJECT, UPDATE)
# ==========================================
class TaskActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        actor = request.user
        action = request.data.get('action', 'UPDATE_PROGRESS')

        is_authority = (
            actor.role in ['SUPERVISOR', 'DEPT_HEAD', 'BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN']
            or actor.is_superuser
            or task.created_by == actor
        )

        if not is_authority and task.assigned_to != actor:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

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
                remarks="Task assignment accepted by employee."
            )
            return Response(TaskSerializer(task, context={'request': request}).data)

        # --- 2. REJECT TASK ---
        elif action == 'REJECT':
            if task.assigned_to != actor:
                raise PermissionDenied("Only the assigned employee can decline this task.")
            if task.status != 'REQUEST_PENDING':
                return Response({'detail': 'Task is not in pending state.'}, status=status.HTTP_400_BAD_REQUEST)

            rejection_reason = request.data.get('rejection_reason')
            rejection_remarks = request.data.get('rejection_remarks', '').strip()

            if not rejection_reason or not rejection_remarks:
                return Response({'detail': 'A valid rejection reason category and remarks are mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

            task.status = 'REJECTED'
            task.rejection_reason = rejection_reason
            task.rejection_remarks = rejection_remarks
            task.save(update_fields=['status', 'rejection_reason', 'rejection_remarks'])

            reason_display = getattr(task, 'get_rejection_reason_display', lambda: task.rejection_reason)()

            # Record in Unified Reason Review Queue
            submission = TaskReasonSubmission.objects.create(
                task=task,
                submitted_by=actor,
                form_type='REJECTION',
                reason_category=rejection_reason,
                explanation=rejection_remarks,
                status='PENDING_REVIEW'
            )

            # Notification for Assigner
            if task.created_by and task.created_by != actor:
                Notification.objects.create(
                    recipient=task.created_by,
                    sender=actor,
                    task=task,
                    notification_type='TASK_REJECTED',
                    title='Task Assignment Declined',
                    message=f"{actor.full_name or actor.username} declined '{task.title}'. Reason: {reason_display}.",
                    data={'task_id': task.id, 'submission_id': submission.id, 'reason': rejection_reason, 'remarks': rejection_remarks}
                )

            # Notification for Direct Reporting Lead (if distinct from assigner)
            if actor.reports_to and actor.reports_to != task.created_by:
                Notification.objects.create(
                    recipient=actor.reports_to,
                    sender=actor,
                    task=task,
                    notification_type='TASK_REJECTED',
                    title='Subordinate Declined Task',
                    message=f"{actor.full_name or actor.username} declined task '{task.title}' assigned by {task.created_by.username}.",
                    data={'task_id': task.id, 'submission_id': submission.id}
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
            return Response(TaskSerializer(task, context={'request': request}).data)

        # --- 3. UPDATE PROGRESS / STATUS / METADATA ---
        # Update metadata if supervisor or manager provided it
        if is_authority:
            if 'due_date' in request.data:
                task.due_date = request.data.get('due_date') or None
            if 'title' in request.data:
                task.title = request.data.get('title')
            if 'description' in request.data:
                task.description = request.data.get('description')

        new_status = request.data.get('status', task.status)
        new_progress = request.data.get('progress_percentage', task.progress_percentage)
        remarks = request.data.get('remarks', '')

        if new_status in ['CANCELLED', 'VERIFIED'] and not is_authority:
            return Response({'detail': 'Only supervisors or managers can cancel or verify tasks.'}, status=status.HTTP_403_FORBIDDEN)

        # Automatic verification routing on 100% progress
        if new_progress == 100:
            if task.requires_verification and not is_authority:
                new_status = 'AWAITING_VERIFICATION'
            else:
                new_status = 'VERIFIED'
                if is_authority and not task.verified_by:
                    task.verified_by = actor

        task.status = new_status
        task.progress_percentage = new_progress
        task.save()

        # Mark daily commitment active if updated today
        today = timezone.localtime(timezone.now()).date()
        DailyWorkSelection.objects.filter(
            user=actor, task=task, date=today
        ).update(has_status_changed_today=True)

        TaskActivityLog.objects.create(
            task=task,
            actor=actor,
            old_status=old_status,
            new_status=new_status,
            old_progress=old_progress,
            new_progress=new_progress,
            remarks=remarks or f"Progress updated to {new_progress}% ({new_status}) by {actor.username}"
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
                'overdue_reason_submitted': t.overdue_reason_submitted,
            })

        selected_task_ids = [s.task_id for s in selections]

        return Response({
            'today': today,
            'date': today,
            'is_on_duty': is_on_duty,
            'selected_task_ids': selected_task_ids,
            'selected_tasks': selected_tasks_payload,
            'available_tasks': TaskSerializer(eligible_tasks, many=True).data,
            'is_idle': len(selected_task_ids) == 0
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
    """
    Assignee submits an overdue delay explanation and proposed future due date.
    Locks the submission button and alerts authorities.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_disabled=False)
        user = request.user

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

        submission = TaskReasonSubmission.objects.create(
            task=task,
            submitted_by=user,
            form_type='OVERDUE_DELAY',
            reason_category=reason_category,
            explanation=explanation,
            expected_due_date=parsed_date,
            status='PENDING_REVIEW'
        )

        # Notify Assigner
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

        # Notify Direct Manager
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

        return Response({
            'status': 'success',
            'detail': 'Overdue delay report submitted for authority review.',
            'submission_id': submission.id
        }, status=status.HTTP_201_CREATED)


class AuthorityReasonReviewView(APIView):
    """
    Lists pending and historical submissions for reporting authorities.
    Allows managers to RESCHEDULE (set new due date, reset overdue lock) or CANCEL tasks.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        form_type = request.query_params.get('form_type')
        status_filter = request.query_params.get('status', 'PENDING_REVIEW')

        if user.is_superuser or user.role in ['ADMIN', 'SUPER_ADMIN']:
            qs = TaskReasonSubmission.objects.all()
        else:
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            qs = TaskReasonSubmission.objects.filter(
                models.Q(submitted_by_id__in=subordinate_ids) |
                models.Q(task__created_by=user)
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
        action_type = request.data.get('action')  # 'RESCHEDULE', 'CANCEL', or 'VERIFY'
        reviewer_remarks = request.data.get('remarks', '').strip()
        manager = request.user
        task = submission.task

        subordinate_ids = get_subordinate_ids(manager, include_self=True)
        is_authorized = (
            manager.is_superuser or
            manager.role in ['ADMIN', 'SUPER_ADMIN'] or
            task.created_by == manager or
            submission.submitted_by_id in subordinate_ids
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
            task.overdue_reason_submitted = False  # Reset lock
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
                message=f"Your delay report for '{task.title}' was reviewed by {manager.full_name or manager.username}. Due date rescheduled to {parsed_due_date}.",
                data={'task_id': task.id, 'action': 'RESCHEDULED', 'new_due_date': str(parsed_due_date)}
            )

            TaskActivityLog.objects.create(
                task=task,
                actor=manager,
                old_status=task.status,
                new_status=task.status,
                old_progress=task.progress_percentage,
                new_progress=task.progress_percentage,
                remarks=f"Due date rescheduled to {parsed_due_date} by {manager.username}. Progress preserved ({task.progress_percentage}%). Remarks: {reviewer_remarks}"
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
                title='Task Cancelled by Authority',
                message=f"Task '{task.title}' was reviewed and cancelled by {manager.full_name or manager.username}.",
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

        elif action_type in ['VERIFY', 'ACKNOWLEDGE']:
            submission.status = 'VERIFIED'
            submission.reviewed_by = manager
            submission.reviewer_remarks = reviewer_remarks
            submission.actioned_at = timezone.now()
            submission.save()

        return Response({'status': 'success', 'message': f'Submission marked as {submission.status}.'})


# ==========================================
# 6. SUPERVISOR TEAM OVERVIEW
# ==========================================
class SupervisorTeamOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()

        if user.role in ['ADMIN', 'SUPER_ADMIN'] or user.is_superuser:
            subordinates = User.objects.exclude(id=user.id)
        elif user.role == 'SUPERVISOR':
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            subordinates = User.objects.filter(id__in=subordinate_ids)
        else:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        subordinates = subordinates.select_related('department', 'matrix__department')
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
            
            # Active incomplete tasks committed today
            active_committed = [
                c for c in emp_commitments 
                if c.task.status in ACTIVE_WORK_STATUSES and c.task.progress_percentage < 100
            ]
            committed_count = len(emp_commitments)
            is_idle = is_present and (len(active_committed) == 0)

            dept_obj = emp.department or (emp.matrix.department if getattr(emp, 'matrix', None) else None)
            primary_dept_name = dept_obj.name if dept_obj else 'General'

            primary_task_title = (
                emp_commitments[0].task.title if emp_commitments
                else ('On Leave' if not is_present else 'None Marked Today')
            )

            team_rows.append({
                'id': emp.id,
                'username': emp.username,
                'designation': getattr(emp, 'designation', '') or 'Staff',
                'department': primary_dept_name,
                'is_present': is_present,
                'active_daily_tasks': committed_count,
                'is_idle': is_idle,
                'load_status': 'ON_LEAVE' if not is_present else ('IDLE' if is_idle else 'ACTIVE'),
                'primary_task_title': primary_task_title
            })

        total_team = len(team_rows)
        present_count = len(present_user_ids)
        working_count = len([r for r in team_rows if r['load_status'] == 'ACTIVE'])
        idle_count = max(0, present_count - working_count)

        return Response({
            'total_team': total_team,
            'present_count': present_count,
            'on_leave_count': total_team - present_count,
            'committed_count': working_count,
            'idle_count': idle_count,
            'members': team_rows
        })


# ==========================================
# 7. ADMIN DEPARTMENTS SUMMARY
# ==========================================
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
# 8. TASK AUDIT LOG LIST VIEW
# ==========================================
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

        date_range = request.query_params.get('range')
        now = timezone.now()
        if date_range == 'today':
            queryset = queryset.filter(timestamp__date=now.date())
        elif date_range == 'last_7_days':
            queryset = queryset.filter(timestamp__gte=now - timedelta(days=7))
        elif date_range == 'last_30_days':
            queryset = queryset.filter(timestamp__gte=now - timedelta(days=30))

        queryset = queryset.order_by('-timestamp')
        
        # Base user 100 limit rule
        if user.role == 'EMPLOYEE':
            queryset = queryset[:100]

        serializer = TaskActivityLogDetailSerializer(queryset, many=True)
        return Response(serializer.data)


class SubmitCommitmentNoActionReasonView(APIView):
    """
    Assignee submits an explanation before shift-end for why a committed
    task had no progress/status update today.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_disabled=False)
        user = request.user

        if task.assigned_to != user:
            return Response({'detail': 'Only the assigned employee can submit a reason for this task.'}, status=status.HTTP_403_FORBIDDEN)

        reason_category = request.data.get('reason_category')
        explanation = request.data.get('explanation', '').strip()

        if not reason_category or not explanation:
            return Response({'detail': 'Reason category and explanation are required.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localtime(timezone.now()).date()

        # Record in unified Reason Submission ledger
        submission = TaskReasonSubmission.objects.create(
            task=task,
            submitted_by=user,
            form_type='NO_ACTION_TODAY',
            reason_category=reason_category,
            explanation=explanation,
            status='PENDING_REVIEW'
        )

        # Flag selection so it is recognized as handled today
        DailyWorkSelection.objects.filter(
            user=user, task=task, date=today
        ).update(has_status_changed_today=True)

        # Notify Assigner
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

        # Notify Direct Reporting Manager
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

        return Response({
            'status': 'success',
            'detail': 'Daily no-action explanation submitted.',
            'submission_id': submission.id
        }, status=status.HTTP_201_CREATED)

class IdleMonitoringStatusView(APIView):
    """
    Evaluates self and team idle state. 
    Triggers an in-app notification if an on-duty user remains idle for >= 5 minutes 
    past their configured idle start time threshold.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.localtime(timezone.now())
        today = now.date()
        current_time = now.time()

        # 1. Evaluate Current User Self-Idle State
        attendance = AttendanceRecord.objects.filter(user=user, date=today).first()
        is_present = attendance.is_present if attendance else False

        # Query incomplete active tasks in today's commitment
        active_commitments_count = DailyWorkSelection.objects.filter(
            user=user,
            date=today,
            task__status__in=['ACCEPTED', 'IN_PROGRESS'],
            task__is_disabled=False
        ).exclude(task__progress_percentage=100).count()

        is_self_idle = is_present and (active_commitments_count == 0)

        # Self-idle timer threshold check
        self_timer_start = getattr(user, 'self_idle_timer_start', None)
        self_threshold_reached = False
        if self_timer_start and current_time >= self_timer_start:
            self_threshold_reached = True

        # Generate self-idle notification if threshold reached and idle
        if is_self_idle and self_threshold_reached:
            recent_self_alert = Notification.objects.filter(
                recipient=user,
                notification_type='IDLE_ALERT',
                created_at__gte=now - timedelta(minutes=30)  # De-duplicate alerts within 30 min window
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

        # 2. Evaluate Down-Tree Team Idle State (For Supervisors, Admins)
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
                if not sub_user or not sub_user.is_active:
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

                    # If team idle threshold reached, notify supervisor
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


# ========================================================
# 11. Today's No-action & No Reason Submitted Auto Trigger 
# ========================================================
class TriggerManualMidnightSweepView(APIView):
    """
    Allows admins or background schedulers to execute the daily inaction sweep.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not (request.user.role in ['ADMIN', 'SUPER_ADMIN'] or request.user.is_superuser):
            return Response({'detail': 'Only Admins can manually invoke the inaction sweep.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            call_command('sweep_daily_inaction')
            return Response({'status': 'success', 'message': 'Midnight inaction sweep executed successfully.'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)