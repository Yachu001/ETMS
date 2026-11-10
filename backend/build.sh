#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

# 1. Upgrade pip and install production dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 2. Gather all Django Admin, Rest Framework, and WhiteNoise static files
python manage.py collectstatic --no-input

# 3. Apply all database migrations to PostgreSQL (Neon / Supabase)
python manage.py migrate