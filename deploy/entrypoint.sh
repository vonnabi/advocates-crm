#!/usr/bin/env bash
# Startup for the CRM web container: migrate, collect static, seed an admin on first
# run (only when the database is empty), then serve with gunicorn.
set -e

cd /app

echo "→ Applying migrations..."
python backend/manage.py migrate --noinput

echo "→ Collecting static files..."
python backend/manage.py collectstatic --noinput

# Seed the bureau admin + demo data ONLY on a completely empty database, so the very
# first deploy has a working login. After logging in: change the admin password and
# (optionally) clear demo data from Settings. Existing data is never overwritten.
if ! python backend/manage.py shell -c "from django.contrib.auth import get_user_model; from apps.clients.models import Client; import sys; sys.exit(0 if (get_user_model().objects.exists() or Client.objects.exists()) else 1)"; then
  echo "→ Empty database — seeding initial admin + demo data..."
  python backend/manage.py seed_demo
fi

echo "→ Starting gunicorn on :8001"
cd backend
exec gunicorn config.wsgi:application --bind 0.0.0.0:8001 --workers 3 --timeout 120
