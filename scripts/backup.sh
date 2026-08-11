#!/bin/sh
# Daily backup for the prod stack (docker-compose.prod.yml): a Postgres
# logical dump + a tarball of the api_storage volume (uploaded files),
# both gzipped, rotated to a fixed retention window. Runs on the VPS via
# cron (see DEPLOY.md §7) — not part of the app image, this is ops
# tooling that lives on the host at /opt/detsad-crm/scripts/backup.sh.
#
# Usage: ./backup.sh   (no args; reads .env.prod for POSTGRES_* creds)

set -eu

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_DIR/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.prod"
BACKUP_DIR="$REPO_DIR/backups"
RETENTION_DAYS=14
STAMP="$(date +%Y%m%d_%H%M%S)"

# .env.prod only sets DOMAIN/POSTGRES_PASSWORD (compose-level overrides);
# POSTGRES_USER/POSTGRES_DB fall back to the same defaults docker-compose.prod.yml uses.
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
POSTGRES_USER="${POSTGRES_USER:-detsad}"
POSTGRES_DB="${POSTGRES_DB:-detsad_crm}"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup $STAMP"

# --- Postgres logical dump ---
db_dump="$BACKUP_DIR/db-$STAMP.sql.gz"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$db_dump.tmp"
mv "$db_dump.tmp" "$db_dump"
echo "[$(date -Iseconds)] DB dump: $db_dump ($(du -h "$db_dump" | cut -f1))"

# --- Uploaded files (api_storage volume) ---
storage_dump="$BACKUP_DIR/storage-$STAMP.tar.gz"
docker run --rm \
  -v detsad-crm_api_storage:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine sh -c "tar czf /backup/storage-$STAMP.tar.gz.tmp -C /data ."
mv "$storage_dump.tmp" "$storage_dump"
echo "[$(date -Iseconds)] Storage archive: $storage_dump ($(du -h "$storage_dump" | cut -f1))"

# --- Rotation: drop anything older than RETENTION_DAYS ---
find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'storage-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "[$(date -Iseconds)] Backup $STAMP done. Current backups:"
ls -lh "$BACKUP_DIR"
