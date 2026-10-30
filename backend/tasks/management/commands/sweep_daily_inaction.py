# backend/tasks/management/commands/sweep_daily_inaction.py

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from tasks.models import DailyWorkSelection, TaskReasonSubmission, TaskActivityLog
from notifications.models import Notification


class Command(BaseCommand):
    help = "Sweeps committed daily tasks with no activity and no reason submitted, escalating to authorities."

    def handle(self, *args, **options):
        now = timezone.localtime(timezone.now())
        yesterday = now.date() - timedelta(days=1)

        self.stdout.write(f"Running daily inaction audit for date: {yesterday}...")

        # 1. Fetch yesterday's selections where no status change was recorded
        unactioned_selections = DailyWorkSelection.objects.filter(
            date=yesterday,
            has_status_changed_today=False,
            task__is_disabled=False
        ).exclude(
            task__status__in=['VERIFIED', 'CANCELLED']
        ).select_related('user', 'task', 'task__created_by', 'user__reports_to')

        escalation_count = 0

        for selection in unactioned_selections:
            user = selection.user
            task = selection.task

            # Check if user submitted an explanation for this task yesterday
            has_submitted_reason = TaskReasonSubmission.objects.filter(
                task=task,
                submitted_by=user,
                form_type='NO_ACTION_TODAY',
                created_at__date=yesterday
            ).exists()

            if not has_submitted_reason:
                # 2. Record Auto Trigger in unified Reason Submissions queue
                submission = TaskReasonSubmission.objects.create(
                    task=task,
                    submitted_by=user,
                    form_type='AUTO_UNSUBMITTED',
                    reason_category='UNSUBMITTED_INACTION',
                    explanation=(
                        f"System Automated Alert: User committed '{task.title}' on {yesterday} "
                        f"but logged zero progress and failed to submit a reason form before shift end."
                    ),
                    status='PENDING_REVIEW'
                )

                # 3. Notify Assigner (Task Creator)
                if task.created_by and task.created_by != user:
                    Notification.objects.create(
                        recipient=task.created_by,
                        sender=None,
                        task=task,
                        notification_type='DAILY_NO_ACTIVITY_ALERT',
                        title='Daily Inaction Without Reason',
                        message=(
                            f"Automated Alert: {user.full_name or user.username} committed to '{task.title}' "
                            f"on {yesterday} with no activity and did not submit a shift-end reason form."
                        ),
                        data={'task_id': task.id, 'submission_id': submission.id, 'user_id': user.id}
                    )

                # 4. Notify Direct Reporting Authority (if different from assigner)
                if user.reports_to and user.reports_to != task.created_by:
                    Notification.objects.create(
                        recipient=user.reports_to,
                        sender=None,
                        task=task,
                        notification_type='DAILY_NO_ACTIVITY_ALERT',
                        title='Subordinate Daily Inaction Without Reason',
                        message=(
                            f"Automated Alert: Subordinate {user.full_name or user.username} committed to "
                            f"'{task.title}' on {yesterday} with zero activity and no reason form submitted."
                        ),
                        data={'task_id': task.id, 'submission_id': submission.id, 'user_id': user.id}
                    )

                # 5. Log immutable audit trail entry
                TaskActivityLog.objects.create(
                    task=task,
                    actor=None,
                    old_status=task.status,
                    new_status=task.status,
                    old_progress=task.progress_percentage,
                    new_progress=task.progress_percentage,
                    remarks=f"System flagged: No activity logged on {yesterday} and no reason form submitted."
                )

                escalation_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully processed {escalation_count} unsubmitted inaction incident(s)."))