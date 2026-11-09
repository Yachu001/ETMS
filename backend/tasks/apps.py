# backend/tasks/apps.py

import os
import sys
from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        # 1. Skip scheduler startup during management, migration, and backup utility commands
        is_manage_command = any(
            cmd in sys.argv for cmd in [
                'makemigrations', 'migrate', 'collectstatic', 
                'shell', 'createsuperuser', 'dumpdata', 'loaddata', 
                'backup_database', 'sweep_daily_inaction'
            ]
        )
        if is_manage_command:
            return

        # 2. Boot scheduler only in the active running server process
        # Prevents double initialization under Django runserver auto-reload
        if os.environ.get('RUN_MAIN') == 'true' or not any('runserver' in arg for arg in sys.argv):
            try:
                from .scheduler import start_scheduler
                start_scheduler()
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Scheduler startup deferred: {e}")