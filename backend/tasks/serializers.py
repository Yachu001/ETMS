from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime

from .models import Task, TaskActivityLog, DailyWorkSelection, TaskDelayReport
from accounts.utils import get_subordinate_ids

User = get_user_model()


def format_short_display_name(user):
    if not user:
        return 'System'
    full_name = getattr(user, 'full_name', '') or ''
    words = full_name.strip().split()
    if words:
        return ' '.join(words[:2])
    return user.username


# ==========================================
# 1. TASK ACTIVITY LOG SERIALIZER
# ==========================================
class TaskActivityLogDetailSerializer(serializers.ModelSerializer):
    task_id = serializers.IntegerField(source='task.id', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)
    created_by_id = serializers.IntegerField(source='task.created_by.id', read_only=True)
    created_by_username = serializers.SerializerMethodField()
    assigned_to_id = serializers.IntegerField(source='task.assigned_to.id', read_only=True)
    assigned_to_username = serializers.SerializerMethodField()
    actor_username = serializers.SerializerMethodField()

    timestamp_formatted = serializers.DateTimeField(
        source='timestamp',
        format='%Y/%m/%d -- %H:%M:%S',
        read_only=True
    )

    class Meta:
        model = TaskActivityLog
        fields = [
            'id',
            'task_id',
            'task_title',
            'created_by_id',
            'created_by_username',
            'assigned_to_id',
            'assigned_to_username',
            'actor',
            'actor_username',
            'old_status',
            'new_status',
            'old_progress',
            'new_progress',
            'remarks',
            'timestamp',
            'timestamp_formatted',
        ]
        read_only_fields = fields

    def get_created_by_username(self, obj):
        if obj.task and obj.task.created_by:
            return format_short_display_name(obj.task.created_by)
        return 'Self'

    def get_assigned_to_username(self, obj):
        if obj.task and obj.task.assigned_to:
            return format_short_display_name(obj.task.assigned_to)
        return 'Unassigned'

    def get_actor_username(self, obj):
        return format_short_display_name(obj.actor)


# ==========================================
# 2. TASK CREATION SERIALIZER
# ==========================================
class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'priority',
            'assigned_to',
            'due_date',
            'requires_verification',
        ]

    def validate_due_date(self, value):
        """
        Enforce that task overdue/due date cannot be in the past
        when creating a new task or setting its deadline.
        """
        if value:
            today = timezone.localtime(timezone.now()).date()
            if value < today:
                raise serializers.ValidationError("Task due date must be today or a future date.")
        return value

    def validate_assigned_to(self, value):
        # 1. Guard against assigning to disabled or inactive users
        if value:
            is_disabled = not value.is_active or getattr(value, 'is_disabled', False)
            if is_disabled:
                raise serializers.ValidationError("Cannot assign tasks to a disabled or inactive user.")

        request = self.context.get('request')
        actor = getattr(request, 'user', None)

        if not actor or not actor.is_authenticated:
            return value

        # Super Admin and Admin can assign globally
        if actor.is_superuser or actor.role in ['ADMIN', 'SUPER_ADMIN']:
            return value

        # Business Admin: Can assign to employees in their business
        if actor.role == 'BUSINESS_ADMIN':
            if actor.business and (value.business == actor.business or (value.matrix and value.matrix.business == actor.business)):
                return value
            raise serializers.ValidationError(f"Cannot assign tasks outside your business ({actor.business.name if actor.business else 'None'}).")

        # Department Admin: Can assign to employees in their department
        if actor.role == 'DEPT_HEAD':
            if actor.department and (value.department == actor.department or (value.matrix and value.matrix.department == actor.department)):
                return value
            raise serializers.ValidationError(f"Cannot assign tasks outside your department ({actor.department.name if actor.department else 'None'}).")

        # Supervisor: Can assign down their hierarchy or to themselves
        if actor.role == 'SUPERVISOR':
            allowed_subordinates = get_subordinate_ids(actor, include_self=True)
            if value.id not in allowed_subordinates and value.matrix != actor.incharge_matrix.first():
                raise serializers.ValidationError(
                    f"You cannot assign tasks to {value.username}. They are outside your matrix / subordinate line."
                )
            return value

        # Standard Base Employees can only create tasks for themselves
        if actor.id != value.id:
            raise serializers.ValidationError(
                "Standard employees are only authorized to create tasks assigned to themselves."
            )

        return value

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        assigned_to = validated_data.get('assigned_to')

        if assigned_to == user:
            validated_data['status'] = 'ACCEPTED'
            validated_data['progress_percentage'] = 0
        else:
            validated_data['status'] = 'REQUEST_PENDING'
            validated_data['progress_percentage'] = 0

        task = super().create(validated_data)

        TaskActivityLog.objects.create(
            task=task,
            actor=user,
            old_status=None,
            new_status=task.status,
            old_progress=0,
            new_progress=0,
            remarks="Task created and logged into system."
        )
        return task


# ==========================================
# 3. TASK FULL SERIALIZER
# ==========================================
class TaskSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.username', read_only=True)
    activity_logs = TaskActivityLogDetailSerializer(many=True, read_only=True)
    is_overdue = serializers.SerializerMethodField()
    is_committed_today = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'priority',
            'status',
            'progress_percentage',
            'created_by',
            'created_by_name',
            'assigned_to',
            'assigned_to_name',
            'due_date',
            'is_overdue',
            'is_committed_today',
            'requires_verification',
            'verified_by',
            'rejection_reason',
            'rejection_remarks',
            'is_disabled',
            'created_at',
            'updated_at',
            'activity_logs',
        ]
        read_only_fields = [
            'created_by',
            'created_by_name',
            'verified_by',
            'created_at',
            'updated_at',
            'is_overdue',
            'is_committed_today',
        ]

    def get_is_committed_today(self, obj):
        today = timezone.localtime(timezone.now()).date()
        return DailyWorkSelection.objects.filter(task=obj, date=today).exists()

    def get_is_overdue(self, obj):
        if not obj.due_date:
            return False
        if obj.status in ['VERIFIED', 'REJECTED', 'CANCELLED'] or obj.progress_percentage == 100:
            return False

        now = timezone.localtime(timezone.now())
        today = now.date()
        current_time = now.time()

        task_due = obj.due_date
        if isinstance(task_due, str):
            try:
                task_due = datetime.strptime(task_due, '%Y-%m-%d').date()
            except ValueError:
                return False

        if today > task_due:
            return True

        if today == task_due and obj.assigned_to:
            shift_end = getattr(obj.assigned_to, 'shift_end_time', None)
            if shift_end and current_time >= shift_end:
                return True

        return False


# ==========================================
# 4. TASK ACTION SERIALIZER
# ==========================================
class TaskActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['ACCEPT', 'REJECT', 'UPDATE_PROGRESS', 'VERIFY', 'REOPEN', 'CANCEL'])
    progress_percentage = serializers.IntegerField(min_value=0, max_value=100, required=False)
    status = serializers.ChoiceField(
        choices=['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION', 'VERIFIED', 'REJECTED', 'CANCELLED'],
        required=False
    )
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    rejection_remarks = serializers.CharField(required=False, allow_blank=True)
    remarks = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        action = attrs.get('action')
        if action == 'REJECT' and not attrs.get('rejection_reason'):
            raise serializers.ValidationError({'rejection_reason': 'Rejection reason is required when rejecting a task.'})
        return attrs


# ==========================================
# 5. DAILY COMMITMENT SERIALIZER
# ==========================================
class DailyCommitmentSerializer(serializers.ModelSerializer):
    task_id = serializers.IntegerField(source='task.id', read_only=True)
    title = serializers.CharField(source='task.title', read_only=True)
    description = serializers.CharField(source='task.description', read_only=True)
    priority = serializers.CharField(source='task.priority', read_only=True)
    status = serializers.CharField(source='task.status', read_only=True)
    progress_percentage = serializers.IntegerField(source='task.progress_percentage', read_only=True)
    created_by_name = serializers.CharField(source='task.created_by.username', read_only=True)
    assigned_to_name = serializers.CharField(source='task.assigned_to.username', read_only=True)
    created_at = serializers.DateTimeField(source='task.created_at', format='%Y-%m-%dT%H:%M:%S', read_only=True)

    class Meta:
        model = DailyWorkSelection
        fields = [
            'id',
            'task_id',
            'title',
            'description',
            'priority',
            'status',
            'progress_percentage',
            'created_by_name',
            'assigned_to_name',
            'created_at',
            'date',
            'has_status_changed_today',
            'is_overdue',
        ]
        read_only_fields = fields


# ==========================================
# 6. TASK DELAY REPORT SERIALIZER
# ==========================================
class TaskDelayReportSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.CharField(source='submitted_by.username', read_only=True)
    routed_to_name = serializers.CharField(source='routed_to.username', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)

    class Meta:
        model = TaskDelayReport
        fields = [
            'id', 'task', 'task_title', 'submitted_by', 'submitted_by_name',
            'routed_to', 'routed_to_name', 'reason_category', 'explanation',
            'expected_completion_date', 'created_at'
        ]
        read_only_fields = ['id', 'submitted_by', 'submitted_by_name', 'routed_to_name', 'task_title', 'created_at']