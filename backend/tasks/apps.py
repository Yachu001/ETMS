# backend/tasks/apps.py

import os
import sys
from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        # Prevent starting scheduler twice during local auto-reloads
        # or when running utility commands (like migrate or makemigrations)
        is_manage_command = any(
            cmd in sys.argv for cmd in ['makemigrations', 'migrate', 'collectstatic', 'shell']
        )
        if is_manage_command:
            return

        # Check Django reloader flag for local dev
        if os.environ.get('RUN_MAIN') == 'true' or 'gunicorn' in sys.argv[0]:
            from .scheduler import start_scheduler
            start_scheduler()