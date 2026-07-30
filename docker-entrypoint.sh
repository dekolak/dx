#!/bin/sh
set -e

# Applique les migrations en attente puis démarre Next.
echo "→ prisma migrate deploy"
npx prisma migrate deploy

echo "→ démarrage Next.js sur le port ${PORT:-3000}"
exec npm run start -- -p "${PORT:-3000}"
