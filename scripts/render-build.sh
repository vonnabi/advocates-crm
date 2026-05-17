#!/usr/bin/env bash
set -o errexit

PYTHON_BIN="${PYTHON:-}"
if [ -z "$PYTHON_BIN" ]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN=python
  else
    PYTHON_BIN=python3
  fi
fi

"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip install -r requirements.txt
"$PYTHON_BIN" backend/manage.py collectstatic --no-input
