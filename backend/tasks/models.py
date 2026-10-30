# backend/tasks/models.py

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class Task(models.Model):
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )

    STATUS_CHOICES = (
        ('REQUEST_PENDING', 'Request Pending'),
        ('ACCEPTED', 'Accepted'),
        ('IN_PROGRESS', 'In Progress'),
        ('ON_HOLD', 'On Hold'),
        ('AWAITING_VERIFICATION', 'Awaiting Verification'),
        ('VERIFIED', 'Verified / Closed'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    )

    REJECTION_REASONS = (
        ('TERRITORY', 'Not in my territory / Wrong department'),
        ('BANDWIDTH', 'Workload overload / Capacity full'),
        ('UNCLEAR', 'Lacks required specs / Unclear resources'),
        ('OTHER', 'Other (See remarks)'),
    )

    # Core Identifiers
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='REQUEST_PENDING')
    progress_percentage = models.PositiveSmallIntegerField(default=0)

    # Ownership & Assignment Scopes
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_tasks'
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='assigned_tasks'
    )

    # Deadlines & Verification
    due_date = models.DateField(null=True, blank=True)
    requires_verification = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_tasks'
    )

    # Overdue Locking & Submissions
    overdue_reason_submitted = models.BooleanField(
        default=False,
        help_text="True once employee submits an overdue explanation form"
    )

    # Rejection Metadata
    rejection_reason = models.CharField(max_length=50, choices=REJECTION_REASONS, null=True, blank=True)
    rejection_remarks = models.TextField(null=True, blank=True)

    # State Flags & Timestamps
    is_disabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.progress_percentage > 100:
            raise ValidationError({'progress_percentage': 'Progress cannot exceed 100%.'})

        if self.status == 'REJECTED' and not self.rejection_reason:
            raise ValidationError({'rejection_reason': 'A rejection reason is mandatory when declining a task.'})

    @property
    def is_self_created(self):
        return self.created_by_id == self.assigned_to_id

    @property
    def is_overdue(self):
        if not self.due_date:
            return False
        if self.status in ['VERIFIED', 'CANCELLED']:
            return False
            
        today = timezone.localtime(timezone.now()).date()
        if self.due_date < today:
            return True
            
        # If due today, check whether the shift end time has passed
        if self.due_date == today and self.assigned_to:
            current_time = timezone.localtime(timezone.now()).time()
            shift_end = getattr(self.assigned_to, 'shift_end_time', None)
            if shift_end and current_time >= shift_end:
                return True
                
        return False

    def __str__(self):
        return f"{self.title} [{self.get_status_display()}] - Assignee: {self.assigned_to.username}"


class DailyWorkSelection(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='daily_commitments'
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='daily_selections'
    )
    date = models.DateField(default=timezone.now)
    has_status_changed_today = models.BooleanField(default=False)
    is_overdue = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'task', 'date')
        verbose_name = "Daily Work Selection"
        verbose_name_plural = "Daily Work Selections"

    def __str__(self):
        return f"{self.user.username} - {self.task.title} ({self.date})"


class TaskActivityLog(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='activity_logs'
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='activity_actions'
    )
    old_status = models.CharField(max_length=30, blank=True, null=True)
    new_status = models.CharField(max_length=30)
    old_progress = models.PositiveSmallIntegerField(default=0)
    new_progress = models.PositiveSmallIntegerField(default=0)
    remarks = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValidationError("TaskActivityLog entries are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("TaskActivityLog entries are immutable and cannot be deleted.")

    def __str__(self):
        return f"Log for Task #{self.task_id} [{self.new_status}] by {self.actor} at {self.timestamp.strftime('%Y-%m-%d %H:%M')}"


class TaskReasonSubmission(models.Model):
    """
    Unified Ledger for Authority Review:
    - Task assignment rejection reasons
    - Overdue delay reports (with expected new due date)
    - Shift-end daily commitment no-action reasons
    - Auto-triggered rollover flags when user fails to submit
    """
    FORM_TYPES = (
        ('REJECTION', 'Task Assignment Rejection'),
        ('OVERDUE_DELAY', 'Overdue Task Delay Report'),
        ('NO_ACTION_TODAY', 'Today Commit No Action Reason'),
        ('AUTO_UNSUBMITTED', 'Auto Triggered: Unsubmitted Daily Inaction'),
    )

    STATUS_CHOICES = (
        ('PENDING_REVIEW', 'Pending Review'),
        ('RESCHEDULED', 'Due Date Rescheduled'),
        ('CANCELLED', 'Task Cancelled'),
        ('VERIFIED', 'Verified / Acknowledged'),
    )

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='reason_submissions'
    )
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='submitted_reasons'
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_reasons'
    )
    form_type = models.CharField(max_length=30, choices=FORM_TYPES)
    reason_category = models.CharField(max_length=100)
    explanation = models.TextField(blank=True, default='')
    expected_due_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING_REVIEW')
    reviewer_remarks = models.TextField(blank=True, default='')
    actioned_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Task Reason Submission"
        verbose_name_plural = "Task Reason Submissions"

    def __str__(self):
        return f"{self.get_form_type_display()} - Task #{self.task_id} [{self.status}]"


# Backward-compatible proxy to prevent breaking existing imports
TaskDelayReport = TaskReasonSubmission