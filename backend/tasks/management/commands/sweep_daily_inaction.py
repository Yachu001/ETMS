# backend/tasks/management/commands/sweep_daily_inaction.py

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from tasks.models import DailyWorkSelection, TaskReasonSubmission, TaskActivityLog
from notifications.models import Notification


class Command(BaseCommand):
    help = "Sweeps committed daily tasks from yesterday with no activity and no reason submitted, escalating to authorities."

    def handle(self, *args, **options):
        # Localize current time before calculating yesterday
        now = timezone.localtime(timezone.now())
        yesterday = now.date() - timedelta(days=1)

        self.stdout.write(f"Running daily inaction audit for date: {yesterday}...")

        # 1. Fetch yesterday's selections where no status change or progress was recorded
        unactioned_selections = DailyWorkSelection.objects.filter(
            date=yesterday,
            has_status_changed_today=False,
            task__is_disabled=False
        ).exclude(
            task__status__in=['VERIFIED', 'CANCELLED', 'REJECTED']
        ).select_related('user', 'task', 'task__created_by', 'user__reports_to')

        escalation_count = 0

        for selection in unactioned_selections:
            user = selection.user
            task = selection.task

            # Check if user already submitted an explanation or if an auto-alert was already created
            has_existing_record = TaskReasonSubmission.objects.filter(
                task=task,
                submitted_by=user,
                created_at__date=now.date(),
                form_type__in=['NO_ACTION_TODAY', 'AUTO_UNSUBMITTED']
            ).exists()

            if not has_existing_record:
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

                # 3. Notify Assigner / Task Creator
                if task.created_by and task.created_by != user:
                    Notification.objects.create(
                        recipient=task.created_by,
                        sender=user,
                        task=task,
                        notification_type='DAILY_NO_ACTIVITY_ALERT',
                        title='Daily Inaction Without Reason',
                        message=(
                            f"Automated Alert: {user.full_name or user.username} committed to '{task.title}' "
                            f"on {yesterday} with no activity and did not submit a shift-end reason form."
                        ),
                        data={'task_id': task.id, 'submission_id': submission.id, 'user_id': user.id}
                    )

                # 4. Notify Direct Reporting Manager (if different from assigner)
                manager = user.reports_to or (hasattr(user, 'get_hierarchical_upstream_lead') and user.get_hierarchical_upstream_lead())
                if manager and manager != task.created_by and manager != user:
                    Notification.objects.create(
                        recipient=manager,
                        sender=user,
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