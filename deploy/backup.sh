#!/usr/bin/env bash
# Daily backup of the Advocates CRM: PostgreSQL database + uploaded document files.
# Writes timestamped, compressed dumps to $BACKUP_DIR and prunes ones older than
# $RETENTION_DAYS. Designed to run from cron (see deploy/BACKUPS.md).
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

COMPOSE_DIR="/opt/crm/deploy"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/crm}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MEDIA_VOLUME="${MEDIA_VOLUME:-advokat-crm_media}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
LOG="$BACKUP_DIR/backup.log"
cd "$COMPOSE_DIR"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*" | tee -a "$LOG"; }

log "=== backup start ($TS) ==="

# 1) PostgreSQL — custom-format dump (restore with pg_restore). Credentials come from
#    the db container's own environment, so nothing secret lives in this script.
db_file="$BACKUP_DIR/db-$TS.dump"
if docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' < /dev/null > "$db_file"; then
  if [ "$(stat -c%s "$db_file")" -lt 1000 ]; then
    log "ERROR: db dump is suspiciously small ($(stat -c%s "$db_file") bytes) — aborting"
    rm -f "$db_file"
    exit 1
  fi
  log "db dump OK   -> $(basename "$db_file") ($(du -h "$db_file" | cut -f1))"
else
  log "ERROR: db dump FAILED"
  rm -f "$db_file"
  exit 1
fi

# 2) Uploaded document files (the media volume), archived with the already-present
#    postgres:16-alpine image so we don't depend on the web container being up.
media_file="$BACKUP_DIR/media-$TS.tar.gz"
if docker run --rm -v "${MEDIA_VOLUME}:/media:ro" postgres:16-alpine \
     tar czf - -C /media . < /dev/null > "$media_file" 2>/dev/null; then
  log "media archive -> $(basename "$media_file") ($(du -h "$media_file" | cut -f1))"
else
  log "WARN: media archive failed (continuing — db dump is the critical copy)"
  rm -f "$media_file"
fi

# 3) Prune old backups.
find "$BACKUP_DIR" -name 'db-*.dump'     -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'media-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

count="$(find "$BACKUP_DIR" -name 'db-*.dump' | wc -l | tr -d ' ')"
log "=== backup done — $count db copies kept, pruned >$RETENTION_DAYS days ==="
