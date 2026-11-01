#!/usr/bin/env bash
#
# Deploy whatever origin/<branch> currently points at, onto this box.
#
#   sudo /srv/nexus-night/app/deploy/deploy.sh [branch]   # defaults to main
#
# Safe to run repeatedly: it exits early when already on the target commit.
# If the build or the post-restart health check fails, it puts the previous
# commit back and restarts, so a bad push cannot leave the site down.
set -euo pipefail

BRANCH="${1:-main}"
APP=/srv/nexus-night/app
SERVICE=nexus-night
RUN_AS=nexus
HEALTH_URL=http://127.0.0.1:3000/
HEALTH_TRIES=30

log() { printf '[deploy] %s\n' "$*"; }
app() { sudo -u "$RUN_AS" bash -c "cd '$APP' && $*"; }

build() {
  # The build reads the same config and secret the service runs with.
  sudo -u "$RUN_AS" bash -c "
    set -a; . /etc/nexus-night/env; set +a
    cd '$APP' && npm run build"
}

healthy() {
  for i in $(seq 1 "$HEALTH_TRIES"); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)
    [ "$code" = "200" ] && return 0
    sleep 1
  done
  return 1
}

cd "$APP"
PREV=$(app "git rev-parse HEAD")
log "current commit $PREV"

app "git fetch --quiet origin '$BRANCH'"
TARGET=$(app "git rev-parse 'origin/$BRANCH'")

if [ "$PREV" = "$TARGET" ] && [ -d "$APP/.next" ]; then
  log "already at $TARGET, nothing to do"
  exit 0
fi
log "deploying $TARGET"

rollback() {
  log "ROLLING BACK to $PREV"
  app "git reset --hard --quiet '$PREV'"
  app "npm ci --no-audit --no-fund --silent" || log "rollback npm ci failed"
  build || log "rollback build failed — the service may be degraded"
  systemctl restart "$SERVICE" || true
  if healthy; then log "rollback healthy"; else log "ROLLBACK UNHEALTHY — needs a human"; fi
}

app "git reset --hard --quiet '$TARGET'"

if ! app "npm ci --no-audit --no-fund --silent"; then
  log "npm ci failed"; rollback; exit 1
fi

if ! build; then
  log "build failed"; rollback; exit 1
fi

log "restarting $SERVICE"
systemctl restart "$SERVICE"

if ! healthy; then
  log "health check failed after restart"; rollback; exit 1
fi

log "deployed $(app "git rev-parse --short HEAD") successfully"
