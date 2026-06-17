#!/bin/bash
# Nightly Postgres backup from Neon → local archive → off-VPS upload.
#
# Runs from /etc/cron.d/inbox-ai-backup (installed by setup-vps.sh).
#
# Why off-VPS uploads matter: this VPS could be reclaimed (Oracle Free
# Tier policy), have its disk corrupted, or get compromised. Local
# backups don't survive those scenarios. The S3 / B2 / GitHub upload
# step is the difference between "30-minute restore" and "data loss."

set -euo pipefail

# -------------------------------------------------------------------
# Config — read DATABASE_URL from the app's .env, or override per-host
# -------------------------------------------------------------------
APP_DIR="${APP_DIR:-/opt/inbox-ai}"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/inbox-ai}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTFILE="$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

# Off-VPS upload: pick exactly one
#   S3_BUCKET=s3://my-backups/inbox-ai
#   B2_BUCKET=b2://my-bucket/inbox-ai
#   RCLONE_DEST=remote:bucket/path
#   (or leave all unset to skip the upload step)
S3_BUCKET="${S3_BUCKET:-}"
B2_BUCKET="${B2_BUCKET:-}"
RCLONE_DEST="${RCLONE_DEST:-}"

log() { echo "[$(date -u +%FT%TZ)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# -------------------------------------------------------------------
# Resolve DATABASE_URL
# -------------------------------------------------------------------
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -r "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  fi
fi
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL not set (env or $ENV_FILE)"

# -------------------------------------------------------------------
# pg_dump from Neon
# -------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"

log "Dumping Postgres → $OUTFILE"

# pg_dump options:
#   --no-owner / --no-acl : restore portable across roles
#   --format=plain        : pipeable through gzip; readable for forensics
#   --clean --if-exists   : restore script drops & recreates atomically
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --clean \
  --if-exists \
  | gzip -9 > "$OUTFILE"

# Sanity check the dump isn't empty
BYTES=$(stat -c %s "$OUTFILE")
[[ "$BYTES" -gt 1024 ]] || fail "Dump suspiciously small ($BYTES bytes) — aborting"

log "Dump complete: $(du -h "$OUTFILE" | cut -f1)"

# -------------------------------------------------------------------
# Off-VPS upload — pick the first configured destination
# -------------------------------------------------------------------
UPLOADED=0
if [[ -n "$S3_BUCKET" ]]; then
  log "Uploading to S3: $S3_BUCKET"
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$OUTFILE" "$S3_BUCKET/$(basename "$OUTFILE")" --quiet
    UPLOADED=1
  else
    log "WARN: S3_BUCKET set but 'aws' CLI not installed — skipping upload"
  fi
elif [[ -n "$B2_BUCKET" ]]; then
  log "Uploading to B2: $B2_BUCKET"
  if command -v b2 >/dev/null 2>&1; then
    b2 upload-file "${B2_BUCKET#b2://}" "$OUTFILE" "$(basename "$OUTFILE")" >/dev/null
    UPLOADED=1
  else
    log "WARN: B2_BUCKET set but 'b2' CLI not installed — skipping upload"
  fi
elif [[ -n "$RCLONE_DEST" ]]; then
  log "Uploading via rclone: $RCLONE_DEST"
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$OUTFILE" "$RCLONE_DEST" --quiet
    UPLOADED=1
  else
    log "WARN: RCLONE_DEST set but 'rclone' not installed — skipping upload"
  fi
else
  log "WARN: no off-VPS upload configured. Backup lives on this disk ONLY."
  log "      Set S3_BUCKET, B2_BUCKET, or RCLONE_DEST in /etc/cron.d/inbox-ai-backup"
  log "      or in $ENV_FILE for survivable backups."
fi

# -------------------------------------------------------------------
# Local retention
# -------------------------------------------------------------------
# Keep N days locally — shorter than off-VPS retention. If the off-VPS
# upload failed and we deleted the only local copy, that's a real loss
# event; safer to keep ~7 days locally so we can re-upload manually.
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
log "Local retention pruned (kept last $RETENTION_DAYS days)"

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
ACTIVE=$(find "$BACKUP_DIR" -name 'db-*.sql.gz' | wc -l)
log "Done. Local backups retained: $ACTIVE. Off-VPS uploaded: $([[ $UPLOADED -eq 1 ]] && echo yes || echo NO)"

# If the upload didn't happen but was supposed to, exit non-zero so the
# cron line surfaces in mail / health monitoring. Otherwise OK.
if [[ -n "${S3_BUCKET}${B2_BUCKET}${RCLONE_DEST}" ]] && [[ "$UPLOADED" -eq 0 ]]; then
  exit 2
fi
