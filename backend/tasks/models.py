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

    # Rejection Metadata
    rejection_reason = models.CharField(max_length=20, choices=REJECTION_REASONS, null=True, blank=True)
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

    def __str__(self):
        return f"{self.title} [{self.get_status_display()}] - Assignee: {self.assigned_to.username}"



class TaskActivityLog(models.Model):
    """
    Immutable audit trail. Rows can only be created, never edited or deleted.
    """
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


class DailyWorkSelection(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_commitments'
    )
    task = models.ForeignKey(
        'tasks.Task',
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

# Append to backend/tasks/models.py

class TaskDelayReport(models.Model):
    DELAY_REASONS = (
        ('BLOCKER', 'External Dependency / Blocker'),
        ('BANDWIDTH', 'Capacity / Unforeseen Workload'),
        ('SCOPE', 'Requirement Changes / Scope Creep'),
        ('TECHNICAL', 'Technical Roadblock / Bug'),
        ('OTHER', 'Other (See remarks)'),
    )

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='delay_reports'
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_delay_reports'
    )
    routed_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_delay_reports'
    )
    reason_category = models.CharField(max_length=30, choices=DELAY_REASONS)
    explanation = models.TextField()
    expected_completion_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Task Delay Report"
        verbose_name_plural = "Task Delay Reports"

    def __str__(self):
        return f"Delay Report for {self.task.title} by {self.submitted_by.username} ({self.created_at.date()})"