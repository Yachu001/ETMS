# backend/notifications/models.py

from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('TASK_ASSIGNED', 'New Task Assigned'),
        ('TASK_ACCEPTED', 'Task Accepted'),
        ('TASK_REJECTED', 'Task Rejected with Reason'),
        ('TASK_OVERDUE', 'Task Overdue Delay Reported'),
        ('TASK_VERIFIED', 'Task Completed & Verified'),
        ('REASON_SUBMITTED', 'Reason Form Submitted'),
        ('REASON_ACTIONED', 'Reason Form Reviewed/Actioned'),
        ('DAILY_NO_ACTIVITY_ALERT', 'Committed Task Inaction Alert'),
        ('IDLE_ALERT', 'Idle User Alert'),
        ('METRIX_TRANSFER', 'Matrix Transfer Alert'),
        ('METRIX_INCHARGE', 'Matrix In-Charge Change Alert'),
    )

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications'
    )
    # Generic reference to task id without strict circular model dependency
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=40, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] -> {self.recipient.username}: {self.title}"