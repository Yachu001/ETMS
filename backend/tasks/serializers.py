from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Task, TaskActivityLog, DailyWorkSelection
from accounts.utils import get_subordinate_ids
from datetime import datetime
from django.utils import timezone


User = get_user_model()

def format_short_display_name(user):
    """
    Returns full_name up to the first two words if available;
    otherwise falls back to username.
    """
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
    """
    Handles task creation with hierarchy validation:
    - Super Admin & Admin: Can assign to anyone in the organization.
    - Supervisor: Can assign down their hierarchy or to themselves.
    - Base Employee: Can strictly create tasks for themselves (self-assignment).
    """
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

    def validate_assigned_to(self, value):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)

        if not actor or not actor.is_authenticated:
            return value

        # Org Admins can assign globally
        if getattr(actor, 'is_org_admin', False) or actor.is_superuser:
            return value

        # Supervisors can assign only down their reporting chain or to themselves
        if getattr(actor, 'is_supervisor_user', False):
            allowed_subordinate_ids = get_subordinate_ids(actor, include_self=True)
            if value.id not in allowed_subordinate_ids:
                raise serializers.ValidationError(
                    f"You cannot assign tasks to {value.username}. They are outside your reporting tree."
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

        # Self-created task skips pending and starts at ACCEPTED (0% - Not Started)
        if assigned_to == user:
            validated_data['status'] = 'ACCEPTED'
            validated_data['progress_percentage'] = 0
        else:
            validated_data['status'] = 'REQUEST_PENDING'
            validated_data['progress_percentage'] = 0

        task = super().create(validated_data)

        # Append initial immutable audit log entry
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
            'is_overdue',   # <--- Added
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
        """Checks if this task is committed in today's DailyWorkSelection."""
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

        # Past date -> Overdue
        if today > task_due:
            return True

        # Today -> Check assignee's shift end time
        if today == task_due and obj.assigned_to:
            shift_end = getattr(obj.assigned_to, 'shift_end_time', None)
            if shift_end and current_time >= shift_end:
                return True

        return False


# ==========================================
# 4. TASK ACTION SERIALIZER
# ==========================================
class TaskActionSerializer(serializers.Serializer):
    """
    Handles state transitions (Accept, Reject, Progress Update, Verify)
    """
    action = serializers.ChoiceField(choices=['ACCEPT', 'REJECT', 'UPDATE_PROGRESS', 'VERIFY', 'REOPEN'])
    progress_percentage = serializers.IntegerField(min_value=0, max_value=100, required=False)
    status = serializers.ChoiceField(
        choices=['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION', 'VERIFIED', 'REJECTED'],
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