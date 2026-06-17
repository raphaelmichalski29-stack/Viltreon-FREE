#!/bin/bash
# One-command, zero-downtime update for Viltreon / Inbox AI.
#
#   sudo /opt/inbox-ai/scripts/update.sh
#
# Pulls latest, installs deps ONLY if the lockfile changed, applies any new DB
# migrations, rebuilds, and rolls the web + worker processes with no downtime.
#
# Why this script instead of a raw `npm run build`: ENCRYPTION_KEY/SALT live
# only in the root-only files (/etc/inbox-ai/encryption-*) and the systemd
# override — never in .env. `next build` runs the production env-guard, which
# requires them present, so a plain build from a shell fails. This injects them
# for the build step only. The pm2 reloads are plain (no --update-env), so the
# running processes keep the env they already have (incl. the key) — they are
# NOT re-read from this shell.
set -euo pipefail

APP_DIR=/opt/inbox-ai
APP_USER=inbox-ai
ENC_KEY_FILE=/etc/inbox-ai/encryption-key
ENC_SALT_FILE=/etc/inbox-ai/encryption-salt
PM2=/usr/lib/node_modules/pm2/bin/pm2
PM2_HOME="/home/$APP_USER/.pm2"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

cd "$APP_DIR"

echo "==> Pulling latest from git"
LOCK_BEFORE=$(sha1sum package-lock.json 2>/dev/null | cut -d' ' -f1 || true)
sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
LOCK_AFTER=$(sha1sum package-lock.json 2>/dev/null | cut -d' ' -f1 || true)

if [[ "$LOCK_BEFORE" != "$LOCK_AFTER" ]]; then
  echo "==> Lockfile changed — installing dependencies"
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci --omit=optional"
else
  echo "==> Dependencies unchanged — skipping npm ci"
fi

echo "==> Prisma client + migrations"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma generate"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma migrate deploy" || \
  echo "    (no migrations to apply, or migrate failed — review output above)"

echo "==> Building"
ENC_KEY="$(cat "$ENC_KEY_FILE")"
ENC_SALT="$(cat "$ENC_SALT_FILE")"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && ENCRYPTION_KEY='$ENC_KEY' ENCRYPTION_SALT='$ENC_SALT' npm run build"

echo "==> Reloading (zero-downtime; env preserved)"
# Plain reload keeps each process's existing env (incl. ENCRYPTION_KEY). Do NOT
# add --update-env here — that would re-read this shell's env and drop the key.
# (If you change ecosystem.config.js itself — e.g. WEB_INSTANCES — reload won't
# pick that up; for that, re-run setup-vps.sh, which injects the key correctly.)
sudo -u "$APP_USER" env PM2_HOME="$PM2_HOME" "$PM2" reload inbox-ai-web
sudo -u "$APP_USER" env PM2_HOME="$PM2_HOME" "$PM2" reload inbox-ai-worker

echo "==> Health check"
code=000
for _ in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 8 http://127.0.0.1:3000/api/health || true)
  [[ "$code" == "200" ]] && break
  sleep 2
done
echo "    /api/health -> $code"
curl -s -m 8 http://127.0.0.1:3000/api/health | head -c 200 2>/dev/null; echo
if [[ "$code" == "200" ]]; then
  echo "==> Update complete."
else
  echo "==> WARNING: health not 200. Check: sudo -u $APP_USER pm2 logs" >&2
  exit 1
fi
