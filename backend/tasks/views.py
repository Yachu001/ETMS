from datetime import timedelta, datetime, date
from django.utils import timezone
from django.db.models import Q, Avg
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Task, DailyWorkSelection, TaskActivityLog, TaskDelayReport
from .serializers import (
    TaskSerializer,
    TaskCreateSerializer,
    TaskActionSerializer,
    DailyCommitmentSerializer,
    TaskActivityLogDetailSerializer,
)
from accounts.models import AttendanceRecord, Department, UserDepartment
from accounts.utils import get_subordinate_ids

User = get_user_model()
ACTIVE_WORK_STATUSES = ['ACCEPTED', 'IN_PROGRESS']

def is_task_overdue_for_user(task, user=None):
    """
    Evaluates whether a task is overdue:
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

    # Normalize due_date to date object if it is a string
    task_due = task.due_date
    if isinstance(task_due, str):
        try:
            task_due = datetime.strptime(task_due, '%Y-%m-%d').date()
        except ValueError:
            return False

    # 1. Past due date is always overdue
    if today > task_due:
        return True

    # 2. Today: Overdue only after shift end time
    elif today == task_due:
        shift_end = getattr(user, 'shift_end_time', None)
        if shift_end and current_time >= shift_end:
            return True

    return False

def is_task_overdue_for_user(task, user):
    """
    Evaluates whether a task is overdue based on date and user shift end time:
    - If task has no due_date -> False
    - If status is terminal (VERIFIED, REJECTED, CANCELLED) or progress == 100 -> False
    - If today > due_date -> True
    - If today == due_date and current_time >= user.shift_end_time -> True
    - Otherwise -> False
    """
    if not task.due_date:
        return False
    if task.status in ['VERIFIED', 'REJECTED', 'CANCELLED'] or task.progress_percentage == 100:
        return False

    now = timezone.localtime(timezone.now())
    today = now.date()
    current_time = now.time()

    if today > task.due_date:
        return True
    elif today == task.due_date:
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
# 3. TASK ACTION VIEW (SLIDER & STATUS)
# ==========================================
class TaskActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = generics.get_object_or_404(Task, pk=pk, is_disabled=False)
        user = request.user
        serializer = TaskActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data.get('action')
        new_progress = serializer.validated_data.get('progress_percentage')
        new_status = serializer.validated_data.get('status')
        remarks = serializer.validated_data.get('remarks', '')
        rejection_reason = serializer.validated_data.get('rejection_reason', '')
        rejection_remarks = serializer.validated_data.get('rejection_remarks', '')

        old_status = task.status
        old_progress = task.progress_percentage

        # ACCEPT
        if action == 'ACCEPT':
            if task.assigned_to != user and not getattr(user, 'is_org_admin', False):
                return Response({'detail': 'Only the assigned user can accept this task.'}, status=status.HTTP_403_FORBIDDEN)
            
            task.status = 'ACCEPTED'
            task.progress_percentage = 0
            task.save()

            TaskActivityLog.objects.create(
                task=task,
                actor=user,
                old_status=old_status,
                new_status='ACCEPTED',
                old_progress=old_progress,
                new_progress=0,
                remarks=remarks or "Task accepted by assignee (Not Started)."
            )
            return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

        # REJECT
        elif action == 'REJECT':
            if task.assigned_to != user and not getattr(user, 'is_org_admin', False):
                return Response({'detail': 'Only the assigned user can reject this task.'}, status=status.HTTP_403_FORBIDDEN)
            if not rejection_reason or not rejection_remarks:
                return Response({'detail': 'Rejection reason category and detailed remarks are mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

            task.status = 'REJECTED'
            task.rejection_reason = rejection_reason
            task.rejection_remarks = rejection_remarks
            task.save()

            TaskActivityLog.objects.create(
                task=task,
                actor=user,
                old_status=old_status,
                new_status='REJECTED',
                old_progress=old_progress,
                new_progress=old_progress,
                remarks=f"[{rejection_reason}] {rejection_remarks}"
            )
            return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

        # UPDATE PROGRESS / SLIDER
        elif action == 'UPDATE_PROGRESS':
            if new_progress is None:
                new_progress = old_progress

            computed_status = new_status if new_status else old_status

            if computed_status != 'ON_HOLD':
                if new_progress == 0:
                    computed_status = 'ACCEPTED'
                elif 0 < new_progress < 100:
                    computed_status = 'IN_PROGRESS'
                elif new_progress == 100:
                    is_self_task = (task.created_by == task.assigned_to == user)
                    if task.requires_verification and not is_self_task:
                        computed_status = 'AWAITING_VERIFICATION'
                    else:
                        computed_status = 'VERIFIED'

            task.progress_percentage = new_progress
            task.status = computed_status
            task.save()

            today = timezone.now().date()
            DailyWorkSelection.objects.filter(
                user=user, task=task, date=today
            ).update(has_status_changed_today=True)

            TaskActivityLog.objects.create(
                task=task,
                actor=user,
                old_status=old_status,
                new_status=computed_status,
                old_progress=old_progress,
                new_progress=new_progress,
                remarks=remarks or f"Progress slider updated to {new_progress}%."
            )
            return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

        return Response({'detail': 'Invalid action requested.'}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# 4. DAILY COMMITMENTS (PLANNER VIEW)
# ==========================================
class DailyCommitmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()

        # Check attendance
        attendance = AttendanceRecord.objects.filter(user=user, date=today).first()
        is_on_duty = attendance.is_present if attendance else False

        # 1. Fetch active candidate tasks (ACCEPTED, IN_PROGRESS, ON_HOLD)
        raw_candidates = Task.objects.filter(
            assigned_to=user,
            is_disabled=False,
            status__in=['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD']
        ).exclude(progress_percentage=100).order_by('-created_at')

        # 2. Filter out overdue tasks from daily planner candidate pool
        eligible_tasks = [t for t in raw_candidates if not is_task_overdue_for_user(t, user)]

        # 3. Active selections for today
        selections = DailyWorkSelection.objects.filter(
            user=user, date=today
        ).select_related('task', 'task__created_by', 'task__assigned_to')

        # Build response objects ensuring task.id is preserved
        selected_tasks_payload = []
        for s in selections:
            t = s.task
            selected_tasks_payload.append({
                'id': t.id,  # Points to Task ID to avoid 404 in action calls
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

        # Sync unselected
        DailyWorkSelection.objects.filter(user=user, date=today).exclude(task_id__in=task_ids).delete()

        # Validate candidates are strictly non-overdue and active
        valid_candidates = Task.objects.filter(
            id__in=task_ids,
            assigned_to=user,
            is_disabled=False,
            status__in=['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD']
        ).exclude(progress_percentage=100)

        committed_count = 0
        for task in valid_candidates:
            if is_task_overdue_for_user(task, user):
                continue  # Disallow committing to overdue tasks until resolved

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
# 5. OVERDUE TASK DELAY REPORT
# ==========================================
class TaskDelayReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        task = generics.get_object_or_404(Task, pk=pk, is_disabled=False)
        user = request.user

        if task.assigned_to != user and not getattr(user, 'is_org_admin', False):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get('reason_category')
        explanation = request.data.get('explanation')
        expected_date = request.data.get('expected_completion_date')

        if not reason or not explanation or not expected_date:
            return Response({'detail': 'Missing mandatory fields.'}, status=status.HTTP_400_BAD_REQUEST)

        routed_manager = task.created_by if task.created_by != user else None
        if not routed_manager:
            primary_rep = user.reporting_assignments.filter(is_primary=True).select_related('manager').first()
            if primary_rep:
                routed_manager = primary_rep.manager

        TaskDelayReport.objects.create(
            task=task,
            submitted_by=user,
            routed_to=routed_manager,
            reason_category=reason,
            explanation=explanation.strip(),
            expected_completion_date=expected_date
        )

        TaskActivityLog.objects.create(
            task=task,
            actor=user,
            old_status=task.status,
            new_status=task.status,
            old_progress=task.progress_percentage,
            new_progress=task.progress_percentage,
            remarks=f"[DELAY EXPLANATION - {reason}] Expected: {expected_date}. Notes: {explanation.strip()}"
        )

        return Response({'detail': 'Delay report recorded successfully.'}, status=status.HTTP_201_CREATED)


# ==========================================
# 6. SUPERVISOR TEAM OVERVIEW
# ==========================================
class SupervisorTeamOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        if user.is_org_admin:
            subordinates = User.objects.exclude(id=user.id)
        elif user.is_supervisor_user:
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            subordinates = User.objects.filter(id__in=subordinate_ids)
        else:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        subordinates = subordinates.prefetch_related('user_departments__department')
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
            committed_count = len(emp_commitments)
            is_idle = is_present and (committed_count == 0)

            primary_dept_name = 'General'
            for ud in emp.user_departments.all():
                if ud.is_primary:
                    primary_dept_name = ud.department.name
                    break

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
        committed_user_ids = set(commitments_by_user.keys())
        working_count = len(committed_user_ids.intersection(present_user_ids))
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
        if not request.user.is_org_admin:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.now().date()
        departments = Department.objects.prefetch_related('user_departments__user').all()
        dept_data = []

        for dept in departments:
            users = [ud.user for ud in dept.user_departments.all()]
            total_users = len(users)
            user_ids = [u.id for u in users]

            present_user_ids = set(
                AttendanceRecord.objects.filter(
                    user_id__in=user_ids, date=today, is_present=True
                ).values_list('user_id', flat=True)
            )

            committed_user_ids = set(
                DailyWorkSelection.objects.filter(
                    user_id__in=user_ids, date=today
                ).values_list('user_id', flat=True)
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

        if getattr(user, 'is_org_admin', False) or user.is_superuser:
            pass
        elif getattr(user, 'is_supervisor_user', False):
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
        serializer = TaskActivityLogDetailSerializer(queryset, many=True)
        return Response(serializer.data)