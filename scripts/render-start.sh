#!/usr/bin/env bash
set -o errexit

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON:-}"
if [ -z "$PYTHON_BIN" ]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN=python
  else
    PYTHON_BIN=python3
  fi
fi

if [[ "$PYTHON_BIN" == */* && "$PYTHON_BIN" != /* ]]; then
  PYTHON_BIN="$PROJECT_ROOT/$PYTHON_BIN"
fi

"$PYTHON_BIN" backend/manage.py migrate --noinput

if "$PYTHON_BIN" backend/manage.py shell -c "from apps.clients.models import Client; raise SystemExit(0 if Client.objects.filter(is_demo=True).exists() else 1)"; then
  "$PYTHON_BIN" backend/manage.py seed_demo --clear
elif ! "$PYTHON_BIN" backend/manage.py shell -c "from django.contrib.auth import get_user_model; from apps.clients.models import Client; User = get_user_model(); raise SystemExit(0 if (User.objects.exists() or Client.objects.exists()) else 1)"; then
  "$PYTHON_BIN" backend/manage.py seed_demo
fi

cd backend
exec "$PYTHON_BIN" -m gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8001}"
