# backend/tasks/scheduler.py

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore
from django.core.management import call_command
from django.conf import settings

logger = logging.getLogger(__name__)


def run_morning_inaction_sweep():
    """
    Automated job triggered every morning at 08:00 AM.
    Executes the sweep_daily_inaction command to audit the previous day.
    """
    try:
        logger.info("Executing scheduled daily inaction morning sweep...")
        call_command('sweep_daily_inaction')
    except Exception as e:
        logger.error(f"Error during scheduled inaction sweep: {e}")


def start_scheduler():
    """
    Starts the in-process background scheduler.
    Operates identically across Windows, macOS, Linux, Railway, and Hostinger.
    """
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")

    # Schedule: Every day at 08:00 AM
    scheduler.add_job(
        run_morning_inaction_sweep,
        trigger='cron',
        hour=8,
        minute=0,
        id='morning_inaction_sweep_job',
        max_instances=1,
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Universal In-App Scheduler started successfully.")