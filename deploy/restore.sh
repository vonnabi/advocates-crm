#!/usr/bin/env bash
# Restore the CRM database from a dump created by backup.sh.
#   ./restore.sh /var/backups/crm/db-YYYYMMDD-HHMMSS.dump
# Overwrites the CURRENT database. Media files are restored separately — see BACKUPS.md.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

COMPOSE_DIR="/opt/crm/deploy"
file="${1:-}"

if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage: $0 <db-dump-file>"
  echo "Available:"
  ls -1t /var/backups/crm/db-*.dump 2>/dev/null | head || echo "  (none found in /var/backups/crm)"
  exit 1
fi

cd "$COMPOSE_DIR"
echo "!! This will OVERWRITE the live database with:"
echo "   $file"
read -r -p "Type 'yes' to continue: " ok
[ "$ok" = "yes" ] || { echo "Aborted."; exit 1; }

# Restore over the existing schema (drop objects first, then recreate from the dump).
docker compose exec -T db sh -c \
  'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$file"

echo "Database restored. Restarting web container..."
docker compose restart web
echo "Done."
