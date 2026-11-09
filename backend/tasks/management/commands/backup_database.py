# backend/tasks/management/commands/backup_database.py

import os
import gzip
import shutil
import subprocess
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import send_mail


class Command(BaseCommand):
    help = "Dumps PostgreSQL database, compresses it to .sql.gz, syncs to Google Drive, and sends email notifications."

    def handle(self, *args, **options):
        now = datetime.now()
        timestamp = now.strftime('%Y_%m_%d_%H%M%S')
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        raw_dump_file = os.path.join(backup_dir, f"temp_{timestamp}.sql")
        backup_gz_file = os.path.join(backup_dir, f"teampulse_db_{timestamp}.sql.gz")
        db_conf = settings.DATABASES['default']

        self.stdout.write(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Starting PostgreSQL database backup...")

        env = os.environ.copy()
        env['PGPASSWORD'] = str(db_conf.get('PASSWORD', '123456'))

        host = str(db_conf.get('HOST', '127.0.0.1'))
        port = str(db_conf.get('PORT', '5432'))
        user = str(db_conf.get('USER', 'teampulse_user'))
        dbname = str(db_conf.get('NAME', 'teampulse_db'))

        # Run pg_dump directly to a raw SQL file
        dump_cmd = [
            "pg_dump",
            "-h", host,
            "-p", port,
            "-U", user,
            "-d", dbname,
            "-f", raw_dump_file
        ]

        try:
            # 1. Execute PostgreSQL dump
            subprocess.run(dump_cmd, env=env, check=True)

            # 2. Compress using Python's built-in gzip
            with open(raw_dump_file, 'rb') as f_in:
                with gzip.open(backup_gz_file, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)

            # Clean up temporary uncompressed dump file
            if os.path.exists(raw_dump_file):
                os.remove(raw_dump_file)

            self.stdout.write(self.style.SUCCESS(f"Local backup archive generated: {backup_gz_file}"))

            # 3. Off-site cloud upload to Google Drive via Rclone
            self.upload_to_gdrive(backup_gz_file)

            # 4. Prune local archives older than 30 days
            self.prune_old_backups(backup_dir, retention_days=30)

            # 5. Send daily success notification email
            file_size_mb = round(os.path.getsize(backup_gz_file) / (1024 * 1024), 2)
            self.send_status_email(
                is_success=True,
                subject=f"✅ [SUCCESS] TeamPulse DB Backup - {now.strftime('%d %b %Y')}",
                body=(
                    f"TeamPulse ETMS automated database backup was completed successfully.\n\n"
                    f"• Timestamp: {now.strftime('%Y-%m-%d %H:%M:%S')}\n"
                    f"• Archive File: {os.path.basename(backup_gz_file)}\n"
                    f"• Archive Size: {file_size_mb} MB\n"
                    f"• Local Storage: {backup_gz_file}\n"
                    f"• Cloud Destination: Google Drive (Folder: TeamPulse_ETMS_Backups)\n\n"
                    f"The backup copy is synchronized off-site."
                )
            )

        except subprocess.CalledProcessError as e:
            if os.path.exists(raw_dump_file):
                os.remove(raw_dump_file)
            err_msg = f"Database backup command failed with exit code {e.returncode}."
            self.stdout.write(self.style.ERROR(err_msg))
            self.send_failure_email(err_msg, now)

        except Exception as e:
            if os.path.exists(raw_dump_file):
                os.remove(raw_dump_file)
            err_msg = f"Backup process encountered an error: {e}"
            self.stdout.write(self.style.ERROR(err_msg))
            self.send_failure_email(err_msg, now)

    def upload_to_gdrive(self, filepath):
        """Uploads the local compressed backup to company Google Drive using Rclone."""
        # 1. Check if rclone is available in PATH
        rclone_bin = shutil.which("rclone")

        # 2. Fallback to the exact winget package executable on this machine
        if not rclone_bin:
            winget_path = os.path.expandvars(
                r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe\rclone-v1.75.2-windows-amd64\rclone.exe"
            )
            if os.path.exists(winget_path):
                rclone_bin = winget_path
            else:
                rclone_bin = "rclone"

        rclone_cmd = [
            rclone_bin, "copy",
            filepath,
            "gdrive:TeamPulse_ETMS_Backups"
        ]
        self.stdout.write(f"Syncing backup archive via {rclone_bin} to Google Drive...")
        subprocess.run(rclone_cmd, check=True)
        self.stdout.write(self.style.SUCCESS("✓ Successfully synced backup to Google Drive (Off-Site)."))

    def prune_old_backups(self, backup_dir, retention_days=30):
        cutoff = datetime.now() - timedelta(days=retention_days)
        cutoff_timestamp = cutoff.timestamp()

        for filename in os.listdir(backup_dir):
            filepath = os.path.join(backup_dir, filename)
            if os.path.isfile(filepath) and filename.startswith("teampulse_db_") and filename.endswith(".sql.gz"):
                if os.path.getmtime(filepath) < cutoff_timestamp:
                    try:
                        os.remove(filepath)
                        self.stdout.write(f"Pruned outdated archive: {filename}")
                    except OSError as err:
                        self.stdout.write(self.style.WARNING(f"Could not remove {filename}: {err}"))

    def send_failure_email(self, error_detail, timestamp):
        self.send_status_email(
            is_success=False,
            subject=f"❌ [ALERT] TeamPulse DB Backup FAILED - {timestamp.strftime('%d %b %Y')}",
            body=(
                f"CRITICAL WARNING: TeamPulse automated database backup failed!\n\n"
                f"• Attempt Time: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}\n"
                f"• Error Encountered: {error_detail}\n\n"
                f"Please inspect the server terminal and database status."
            )
        )

    def send_status_email(self, is_success, subject, body):
        admin_email = getattr(settings, 'ADMIN_ALERT_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None)
        if not admin_email:
            self.stdout.write(self.style.WARNING("ADMIN_ALERT_EMAIL not set in settings or .env. Email skipped."))
            return

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin_email],
                fail_silently=False,
            )
            self.stdout.write(self.style.SUCCESS(f"Status alert email sent to {admin_email}."))
        except Exception as mail_err:
            self.stdout.write(self.style.WARNING(f"Could not dispatch email alert: {mail_err}"))