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


def run_nightly_backup():
    """
    Automated job triggered every night at 02:00 AM.
    Executes the backup_database command to create a compressed PostgreSQL archive.
    """
    try:
        logger.info("Executing scheduled nightly PostgreSQL database backup...")
        call_command('backup_database')
    except Exception as e:
        logger.error(f"Error during scheduled nightly database backup: {e}")


def start_scheduler():
    """
    Starts the in-process background scheduler.
    Registers jobs to PostgreSQL django_apscheduler with explicit IDs and max_instances=1.
    """
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")

    # 1. Schedule: Every day at 08:00 AM (Morning Inaction Sweep)
    scheduler.add_job(
        run_morning_inaction_sweep,
        trigger='cron',
        hour=8,
        minute=0,
        id='morning_inaction_sweep_job',
        max_instances=1,
        replace_existing=True,
    )

    # 2. Schedule: Every day at 02:00 AM (Nightly Database Backup)
    scheduler.add_job(
        run_nightly_backup,
        trigger='cron',
        hour=2,
        minute=0,
        id='nightly_db_backup_job',
        max_instances=1,
        replace_existing=True,
    )

    try:
        scheduler.start()
        logger.info("In-App Background APScheduler started successfully.")
    except Exception as e:
        logger.warning(f"Scheduler failed to start or already active: {e}")