#!/bin/bash
# One-time VPS bootstrap for Viltreon / Inbox AI.
# Idempotent — safe to re-run after partial failures or for updates.
#
# Usage:
#   sudo ./scripts/setup-vps.sh <domain> <app-user> <git-repo>
# Example:
#   sudo ./scripts/setup-vps.sh inbox.example.com inbox-ai https://github.com/your-org/inbox-ai.git
#
# Designed for Ubuntu 22.04 / 24.04 LTS. Uses NodeSource for Node 22 LTS
# (Ubuntu's default apt repo ships an EOL version).

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <app-user> <git-repo>}"
APP_USER="${2:?Usage: $0 <domain> <app-user> <git-repo>}"
GIT_REPO="${3:?Usage: $0 <domain> <app-user> <git-repo>}"
APP_DIR="/opt/inbox-ai"
LOG_FILE="/var/log/inbox-ai-setup.log"

# Re-runs should be informative, not noisy.
say() { echo "==> $*" | tee -a "$LOG_FILE"; }
sub() { echo "    $*" | tee -a "$LOG_FILE"; }
err() { echo "[ERR] $*" | tee -a "$LOG_FILE" 1>&2; }

# -------------------------------------------------------------------
# 1. System packages
# -------------------------------------------------------------------
say "Installing system packages"
DEBIAN_FRONTEND=noninteractive apt-get update -q
DEBIAN_FRONTEND=noninteractive apt-get install -yq \
  curl gnupg ca-certificates lsb-release \
  nginx certbot python3-certbot-nginx \
  redis-server git ufw cron logrotate

# -------------------------------------------------------------------
# 2. Node 22 LTS via NodeSource (apt ships EOL versions)
# -------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | grep -oP '\d+' | head -1)" -lt 22 ]]; then
  say "Installing Node 22 LTS from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -yq nodejs
else
  sub "Node 22 already installed: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  say "Installing pm2"
  npm install -g pm2
else
  sub "pm2 already installed"
fi

# -------------------------------------------------------------------
# 3. App user
# -------------------------------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  say "Creating app user: $APP_USER"
  useradd -m -s /bin/bash "$APP_USER"
else
  sub "App user $APP_USER already exists"
fi

# -------------------------------------------------------------------
# 4. Code checkout
# -------------------------------------------------------------------
if [[ ! -d "$APP_DIR/.git" ]]; then
  say "Cloning $GIT_REPO into $APP_DIR"
  mkdir -p "$APP_DIR"
  git clone "$GIT_REPO" "$APP_DIR"
else
  sub "Repository already cloned; pulling latest"
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only || sub "Pull skipped (uncommitted local changes?)"
fi

# The clone runs as root, but npm ci / prisma / build (section 8) and all
# future `git pull` updates run as $APP_USER. Hand the whole tree to the app
# user so it can write node_modules/, .next/, logs/, and pull updates. .env
# is re-chowned (same owner) and locked to 600 in section 5 just below.
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# -------------------------------------------------------------------
# 5. .env scaffold
# -------------------------------------------------------------------
if [[ ! -f "$APP_DIR/.env" ]]; then
  if [[ -f "$APP_DIR/.env.production.template" ]]; then
    say "Bootstrapping .env from .env.production.template — EDIT THIS BEFORE FIRST BOOT"
    cp "$APP_DIR/.env.production.template" "$APP_DIR/.env"
  elif [[ -f "$APP_DIR/.env.example" ]]; then
    say "Bootstrapping .env from .env.example — EDIT THIS BEFORE FIRST BOOT"
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  else
    err "No .env template found. Create $APP_DIR/.env manually."
  fi
else
  sub ".env already exists; leaving in place"
fi
chmod 600 "$APP_DIR/.env"
chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"

# -------------------------------------------------------------------
# 6. Redis hardening
# -------------------------------------------------------------------
REDIS_PASSWORD_FILE="/etc/inbox-ai/redis-password"
mkdir -p /etc/inbox-ai
chmod 700 /etc/inbox-ai

if [[ ! -f "$REDIS_PASSWORD_FILE" ]]; then
  say "Generating Redis password and hardening config"
  REDIS_PASSWORD=$(openssl rand -hex 32)
  echo -n "$REDIS_PASSWORD" > "$REDIS_PASSWORD_FILE"
  chmod 600 "$REDIS_PASSWORD_FILE"

  # Apply to running Redis.
  redis-cli CONFIG SET requirepass "$REDIS_PASSWORD" >/dev/null
  redis-cli -a "$REDIS_PASSWORD" CONFIG SET maxmemory 1gb >/dev/null
  # noeviction (NOT allkeys-lru): this Redis backs the BullMQ job queue, which
  # requires that keys are never evicted under memory pressure — eviction would
  # silently drop queued/in-flight sort jobs. Cache keys carry their own TTLs so
  # they still expire normally; only a genuinely full instance rejects writes.
  redis-cli -a "$REDIS_PASSWORD" CONFIG SET maxmemory-policy noeviction >/dev/null
  redis-cli -a "$REDIS_PASSWORD" CONFIG SET appendonly no >/dev/null
  redis-cli -a "$REDIS_PASSWORD" CONFIG REWRITE >/dev/null

  # Update .env REDIS_URL (only if it's still the default localhost).
  if grep -q "^REDIS_URL=redis://localhost:6379" "$APP_DIR/.env" 2>/dev/null; then
    sed -i "s|^REDIS_URL=redis://localhost:6379|REDIS_URL=redis://default:$REDIS_PASSWORD@localhost:6379|" "$APP_DIR/.env"
  fi
else
  sub "Redis password already configured at $REDIS_PASSWORD_FILE"
fi

systemctl enable --now redis-server >/dev/null

# -------------------------------------------------------------------
# 7. Encryption secrets (root-only systemd drop-in for pm2 service)
# -------------------------------------------------------------------
ENC_SECRETS_DIR="/etc/inbox-ai"
ENC_KEY_FILE="$ENC_SECRETS_DIR/encryption-key"
ENC_SALT_FILE="$ENC_SECRETS_DIR/encryption-salt"
PM2_SERVICE_NAME="pm2-$APP_USER"
PM2_OVERRIDE_DIR="/etc/systemd/system/$PM2_SERVICE_NAME.service.d"

if [[ ! -f "$ENC_KEY_FILE" ]] || [[ ! -f "$ENC_SALT_FILE" ]]; then
  say "Generating ENCRYPTION_KEY and ENCRYPTION_SALT"
  openssl rand -hex 32 > "$ENC_KEY_FILE"
  openssl rand -hex 32 > "$ENC_SALT_FILE"
  chmod 600 "$ENC_KEY_FILE" "$ENC_SALT_FILE"

  echo ""
  echo "================================================================"
  echo "  IMPORTANT: Save these encryption secrets to a password manager"
  echo "  NOW. Losing them means all encrypted OAuth tokens become"
  echo "  unrecoverable and every user must re-sign-in."
  echo ""
  echo "  ENCRYPTION_KEY=$(cat $ENC_KEY_FILE)"
  echo "  ENCRYPTION_SALT=$(cat $ENC_SALT_FILE)"
  echo "================================================================"
  echo ""
else
  sub "Encryption secrets already exist at $ENC_SECRETS_DIR"
fi

# Strip from .env if present (pm2 will get them from systemd override below).
sed -i '/^ENCRYPTION_KEY=/d' "$APP_DIR/.env" 2>/dev/null || true
sed -i '/^ENCRYPTION_SALT=/d' "$APP_DIR/.env" 2>/dev/null || true

# -------------------------------------------------------------------
# 8. Install dependencies, generate Prisma client, build
# -------------------------------------------------------------------
# The build runs `next build` (NODE_ENV=production), which evaluates the
# production env guards in next.config.js. On the very first run .env is a
# fresh copy of the template with placeholder values, so the build (and the
# app at runtime) cannot work yet. Detect the placeholders, tell the operator
# what to fill, and exit cleanly — the script is idempotent, so re-running
# after editing .env picks up here and finishes (build, pm2, nginx, TLS).
if grep -qE 'CHANGE_ME|localhost:3000|sk_test_\.\.\.|generate-via-openssl|YOUR_DOMAIN|YOUR_PROJECT' "$APP_DIR/.env"; then
  say "Base system is configured. Now edit $APP_DIR/.env with real production values, then re-run this script to build and start the app."
  echo ""
  echo "  sudo nano $APP_DIR/.env"
  echo ""
  echo "  Required: NEXTAUTH_URL=https://$DOMAIN, NEXTAUTH_SECRET (openssl rand -hex 32),"
  echo "            GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL (Neon POOLED url),"
  echo "            STRIPE_SECRET_KEY (sk_live_), STRIPE_WEBHOOK_SECRET, STRIPE_*_PRICE_ID,"
  echo "            PUBSUB_OIDC_AUDIENCE, PUBSUB_OIDC_SERVICE_ACCOUNT, GITHUB_TOKEN, GITHUB_REPO"
  echo "  Already set: REDIS_URL. Do NOT add ENCRYPTION_KEY/SALT (injected via systemd)."
  echo ""
  echo "  Then: sudo $0 $DOMAIN $APP_USER <git-repo>"
  exit 0
fi

say "Installing app dependencies + building"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci --omit=optional"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma generate"
# Use migrate deploy (apply committed migrations) — NOT db push (which
# unconditionally syncs the schema, dropping columns silently).
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma migrate deploy" || \
  sub "prisma migrate deploy failed — fall back to db push if this is the very first deploy"
# ENCRYPTION_KEY/SALT live only in the systemd override (root-only), never in
# .env. next.config.js requires them present, so export them from the generated
# key files just for the build command (the build doesn't use their values, but
# the env-presence guard would otherwise abort).
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && ENCRYPTION_KEY='$(cat "$ENC_KEY_FILE")' ENCRYPTION_SALT='$(cat "$ENC_SALT_FILE")' npm run build"

# -------------------------------------------------------------------
# 9. pm2 boot + log rotation + systemd integration
# -------------------------------------------------------------------
say "Configuring pm2"
# Start with ENCRYPTION_KEY/SALT in the child env. pm2 snapshots each process's
# env into dump.pm2 at `pm2 save` time and replays THAT on `pm2 resurrect`
# (boot) — it does NOT propagate the systemd-injected daemon env to children.
# So if the dump is saved without the key, every process crash-loops on boot
# with "ENCRYPTION_KEY environment variable is not set" (the worker imports the
# encryption module at startup; the web only when a request hits it). Inject the
# key here so the saved dump carries it; the systemd override remains as the
# root-only source of truth that this reads from.
ENC_KEY="$(cat "$ENC_KEY_FILE")"
ENC_SALT="$(cat "$ENC_SALT_FILE")"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && ENCRYPTION_KEY='$ENC_KEY' ENCRYPTION_SALT='$ENC_SALT' pm2 startOrReload ecosystem.config.js --update-env"
sudo -u "$APP_USER" pm2 save

# Install pm2-logrotate for the pm2-managed log files. Without this the
# logs/*.log files grow unbounded — the OS-level logrotate below catches
# them at file level but pm2's writer keeps an open handle.
if ! sudo -u "$APP_USER" pm2 list | grep -q "pm2-logrotate"; then
  say "Installing pm2-logrotate module"
  sudo -u "$APP_USER" pm2 install pm2-logrotate
fi
sudo -u "$APP_USER" pm2 set pm2-logrotate:max_size 100M
sudo -u "$APP_USER" pm2 set pm2-logrotate:retain 14
sudo -u "$APP_USER" pm2 set pm2-logrotate:compress true
sudo -u "$APP_USER" pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

# Wire pm2 to start under systemd as $APP_USER, then drop the encryption
# secrets in as a service-level override that pm2 reads at boot.
say "Wiring pm2 systemd integration ($PM2_SERVICE_NAME)"
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

mkdir -p "$PM2_OVERRIDE_DIR"
cat > "$PM2_OVERRIDE_DIR/override.conf" << SYSTEMD
[Service]
# Encryption secrets — readable only by root via the systemd Environment
# directive. Never appears in .env, ps, or /proc/<pid>/environ for non-root.
Environment="ENCRYPTION_KEY=$(cat $ENC_KEY_FILE)"
Environment="ENCRYPTION_SALT=$(cat $ENC_SALT_FILE)"
SYSTEMD
chmod 600 "$PM2_OVERRIDE_DIR/override.conf"

# The pm2 commands above started the daemon directly as $APP_USER, WITHOUT the
# encryption secrets (those come only from the systemd override written just
# above). Any running app procs would crash-loop on the missing ENCRYPTION_KEY.
# Kill that daemon and let systemd (re)start it so it inherits ENCRYPTION_KEY/
# SALT and resurrects the saved process list cleanly. Using `enable --now`
# while the daemon is already up races and fails with Result=protocol —
# Type=forking can't adopt a pre-existing, non-systemd daemon.
sudo -u "$APP_USER" PM2_HOME="/home/$APP_USER/.pm2" pm2 kill >/dev/null 2>&1 || true
systemctl daemon-reload
systemctl reset-failed "$PM2_SERVICE_NAME" 2>/dev/null || true
systemctl enable "$PM2_SERVICE_NAME" >/dev/null
systemctl restart "$PM2_SERVICE_NAME"

# -------------------------------------------------------------------
# 10. Nginx reverse proxy
# -------------------------------------------------------------------
NGINX_SITE="/etc/nginx/sites-available/inbox-ai"
if [[ ! -f "$NGINX_SITE" ]] || ! grep -q "$DOMAIN" "$NGINX_SITE"; then
  say "Writing nginx config for $DOMAIN"
  cat > "$NGINX_SITE" << NGINX
# Rate limit zones, per source IP. Webhook traffic is high-volume (Pub/Sub
# bursts) so its zone has a wider rate; the general API zone is tighter to
# defend against bot/scanner floods. Per-user limits inside the app (Redis)
# are a separate, finer-grained second layer.
limit_req_zone \$binary_remote_addr zone=inbox_webhook:10m rate=100r/s;
limit_req_zone \$binary_remote_addr zone=inbox_api:10m rate=30r/s;
# Per-IP concurrent-connection cap. limit_req throttles request RATE but not
# slow-drip connections that hold sockets open without completing a request
# (slowloris). 100 concurrent per IP is generous for a real user (browsers
# open ~6 per origin, plus a few long-lived SSE streams) while stopping a
# single host from exhausting worker connections. Applied only to the browser
# -facing locations below, NOT the webhook endpoints (Pub/Sub and Stripe push
# from pooled IPs where a concurrent cap could drop legitimate deliveries).
limit_conn_zone \$binary_remote_addr zone=inbox_conn:10m;

server {
    listen 80;
    server_name $DOMAIN;

    # Hide the nginx version from the Server header (ZAP: "Server Leaks
    # Version Information"). Applies to proxied responses and nginx-generated
    # error pages on this vhost.
    server_tokens off;

    # HSTS on every response, including middleware-generated redirects/401s
    # and nginx error pages that bypass Next's headers() (ZAP: "HSTS Not
    # Set"). certbot --nginx rewrites this block to listen 443 ssl, so the
    # header lands on the TLS vhost; browsers ignore HSTS over plain http,
    # so it is harmless pre-certbot. "always" emits it on 4xx/5xx too.
    # Next also sends this header on routed responses; proxy_hide_header
    # drops the upstream copy so clients see exactly one.
    proxy_hide_header Strict-Transport-Security;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Health endpoint stays plain HTTP-reachable for uptime monitors that
    # don't speak SNI properly. Everything else gets redirected to HTTPS
    # via certbot below.
    location = /api/health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP \$remote_addr;
        access_log off;
    }

    location / {
        limit_conn inbox_conn 100;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 600s;  # SSE endpoints need long-poll tolerance
        client_max_body_size 2M;
    }

    # General API rate limit. burst=100 absorbs the parallel-request bursts
    # that a single dashboard mount generates (settings + stats + chart all
    # at once). A bot hitting one endpoint repeatedly from one IP gets
    # capped at 30r/s sustained; legitimate UI traffic flows through.
    location /api/ {
        limit_req zone=inbox_api burst=100 nodelay;
        limit_conn inbox_conn 100;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;  # SSE endpoints
        client_max_body_size 2M;
    }

    location /api/gmail/webhook {
        limit_req zone=inbox_webhook burst=200 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP \$remote_addr;
        client_max_body_size 2M;
    }

    location /api/stripe/webhook {
        limit_req zone=inbox_webhook burst=50 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP \$remote_addr;
        client_max_body_size 1M;
    }
}
NGINX
  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/inbox-ai
  rm -f /etc/nginx/sites-enabled/default
else
  sub "nginx config for $DOMAIN already present"
fi

nginx -t && systemctl reload nginx

# -------------------------------------------------------------------
# 11. TLS via Let's Encrypt
# -------------------------------------------------------------------
if ! certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
  say "Issuing TLS certificate for $DOMAIN"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect
else
  sub "TLS certificate for $DOMAIN already present"
fi

# -------------------------------------------------------------------
# 12. logrotate for app logs (belt-and-suspenders with pm2-logrotate)
# -------------------------------------------------------------------
LOGROTATE_FILE="/etc/logrotate.d/inbox-ai"
if [[ ! -f "$LOGROTATE_FILE" ]]; then
  say "Writing logrotate config"
  cat > "$LOGROTATE_FILE" << 'LOGROTATE'
/opt/inbox-ai/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 inbox-ai inbox-ai
    sharedscripts
    postrotate
        sudo -u inbox-ai pm2 reloadLogs 2>/dev/null || true
    endscript
}
LOGROTATE
else
  sub "logrotate config already present"
fi

# -------------------------------------------------------------------
# 13. UFW firewall (idempotent — ufw command is safe to re-run)
# -------------------------------------------------------------------
say "Configuring UFW firewall"
ufw --force enable >/dev/null
ufw allow ssh >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw status verbose | tee -a "$LOG_FILE"

# -------------------------------------------------------------------
# 14. Daily backup cron (only if backup script is in place)
# -------------------------------------------------------------------
BACKUP_CRON="/etc/cron.d/inbox-ai-backup"
if [[ -f "$APP_DIR/scripts/backup.sh" ]] && [[ ! -f "$BACKUP_CRON" ]]; then
  say "Scheduling daily Neon backup at 03:30 UTC"
  cat > "$BACKUP_CRON" << CRON
30 3 * * * root $APP_DIR/scripts/backup.sh >> /var/log/inbox-ai-backup.log 2>&1
CRON
  chmod 644 "$BACKUP_CRON"
else
  sub "Backup cron already configured (or backup.sh missing)"
fi

# -------------------------------------------------------------------
# 15. Wrap up
# -------------------------------------------------------------------
say "Setup complete"
echo ""
echo "================================================================"
echo "  Inbox AI is now installed at $APP_DIR"
echo "  Visit https://$DOMAIN"
echo ""
echo "  Next steps:"
echo "    1. Edit $APP_DIR/.env with real values:"
echo "       - DATABASE_URL (Neon pooled URL)"
echo "       - NEXTAUTH_URL=https://$DOMAIN"
echo "       - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"
echo "       - STRIPE_SECRET_KEY (live mode)"
echo "       - STRIPE_WEBHOOK_SECRET (from Stripe dashboard)"
echo "       - PUBSUB_OIDC_AUDIENCE / PUBSUB_OIDC_SERVICE_ACCOUNT"
echo "       - GITHUB_TOKEN / GITHUB_REPO (for sort-log archival)"
echo "    2. sudo -u $APP_USER pm2 reload ecosystem.config.js --update-env"
echo "    3. sudo -u $APP_USER pm2 logs (verify clean boot)"
echo ""
echo "  Pub/Sub subscription (run once on your workstation):"
echo "    gcloud pubsub subscriptions create email-sorter-push-sub \\"
echo "      --topic=projects/<project>/topics/email-sorter-push \\"
echo "      --push-endpoint=https://$DOMAIN/api/gmail/webhook \\"
echo "      --push-auth-service-account=<sa-email> \\"
echo "      --push-auth-token-audience=https://$DOMAIN/api/gmail/webhook \\"
echo "      --ack-deadline=60 --message-retention-duration=1d \\"
echo "      --dead-letter-topic=email-sorter-deadletter --max-delivery-attempts=5"
echo "================================================================"
