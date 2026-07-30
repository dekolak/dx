# Image de production pour Coolify (VPS OVH).
# Multi-stage : build complet puis image d'exécution.

# --- Build --------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

# openssl requis par le moteur Prisma.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Le schéma DOIT être présent avant `npm ci` : le script postinstall lance
# `prisma generate`, qui échoue sinon (schéma introuvable). C'est aussi ici que
# le moteur Prisma (libquery_engine-debian-openssl-3.0.x) est téléchargé →
# l'environnement de build a besoin d'un accès réseau sortant.
COPY prisma ./prisma
RUN npm ci

COPY . .
# `build` = prisma generate + next build (voir package.json).
RUN npm run build

# --- Runner -------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# On réutilise les node_modules du build (client Prisma généré + CLI pour les
# migrations au démarrage).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
# Applique les migrations puis démarre le serveur.
CMD ["./docker-entrypoint.sh"]
