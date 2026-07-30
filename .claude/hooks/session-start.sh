#!/bin/bash
# Hook SessionStart — prépare l'environnement pour Claude Code on the web :
# dépendances Node, PostgreSQL démarré, base + migrations prêtes, variables
# d'env exportées pour la session. Idempotent (rejouable sans casse).
set -euo pipefail

# Ne s'exécute qu'en environnement distant (Claude Code on the web). En local,
# on utilise docker compose + .env (cf. README).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

log() { echo "[session-start] $*"; }

# --- Paramètres DB de session (dev/CI, valeurs non sensibles) ----------------
DB_USER="postgres"
DB_PASS="postgres"
DB_NAME="dx"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
export SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
export SEED_ORG_NAME="${SEED_ORG_NAME:-DTS Conception}"
export SEED_USER_EMAIL="${SEED_USER_EMAIL:-teddy@example.com}"
export SEED_USER_PASSWORD="${SEED_USER_PASSWORD:-atelier}"

# --- 1. Dépendances Node (npm install : profite du cache de conteneur) -------
log "npm install"
npm install --no-audit --no-fund --loglevel=error

# --- 2. Démarrage de PostgreSQL (cluster présent dans l'image de base) -------
log "démarrage PostgreSQL"
pg_ctlcluster 16 main start 2>/dev/null || service postgresql start 2>/dev/null || true
for _ in $(seq 1 30); do
  pg_isready -q && break
  sleep 1
done
pg_isready -q || { log "PostgreSQL indisponible"; exit 1; }

# --- 3. Rôle + base (idempotent) ---------------------------------------------
log "configuration base ${DB_NAME}"
su postgres -c "psql -v ON_ERROR_STOP=1 -c \"ALTER USER ${DB_USER} PASSWORD '${DB_PASS}';\"" >/dev/null
if ! su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1; then
  su postgres -c "psql -v ON_ERROR_STOP=1 -c \"CREATE DATABASE ${DB_NAME};\"" >/dev/null
fi

# --- 4. Prisma : client + migrations -----------------------------------------
log "prisma generate + migrate deploy"
npx prisma generate >/dev/null
npx prisma migrate deploy

# --- 5. Compte initial (idempotent) ------------------------------------------
log "seed (org + utilisateur)"
npm run db:seed --silent || log "seed ignoré (déjà présent ?)"

# --- 6. Persistance des variables pour la session ----------------------------
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DATABASE_URL=\"${DATABASE_URL}\""
    echo "export SESSION_SECRET=\"${SESSION_SECRET}\""
    echo "export SEED_ORG_NAME=\"${SEED_ORG_NAME}\""
    echo "export SEED_USER_EMAIL=\"${SEED_USER_EMAIL}\""
    echo "export SEED_USER_PASSWORD=\"${SEED_USER_PASSWORD}\""
  } >> "$CLAUDE_ENV_FILE"
fi

log "prêt — base migrée, login : ${SEED_USER_EMAIL} / ${SEED_USER_PASSWORD}"
