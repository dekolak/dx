# DX — App de référencement technique

Fiches techniques pour l'atelier : **installations, pièces, points annotés sur photo,
historique logiciel, journal**. Mobile-first (PWA), pensé pour un usage rapide à
l'atelier.

> Application indépendante (repo dédié `dekolak/dx`), séparée du monorepo `pose`.
> Mono-utilisateur aujourd'hui, modèle de données déjà multi-organisations pour
> un futur SaaS.

## Stack

Next.js 15 (App Router) · Prisma + PostgreSQL · stockage média sur disque local
(volume Docker, servi via `/api/media`) · PWA · déploiement Coolify (VPS OVH).

## Démarrage rapide

```bash
# 1. Dépendances
npm install

# 2. Base de données locale (Postgres via Docker)
docker compose up -d

# 3. Config
cp .env.example .env      # puis éditer (SESSION_SECRET, SEED_*, UPLOAD_DIR)

# 4. Schéma + compte initial
npm run prisma:migrate    # applique les migrations
npm run db:seed           # crée l'organisation + l'utilisateur (SEED_* de .env)

# 5. Lancer
npm run dev               # http://localhost:3000
```

Connexion avec `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`.

## Concept clé — le bloc « Entry »

Un même bloc réutilisé partout (point / software / journal) : texte + médias +
date + partage + soft delete. Deux actions distinctes :

- **Corriger** une entrée (coquille) — édition en place.
- **Ajouter une info** — nouvelle entrée empilée, l'historique n'est jamais
  écrasé.

## Fonctionnalités

- Installations (machine seule ou atelier) → Pièces → Points (placés sur photo annotée) → Entrées empilées
- Software par installation (timeline / changelog)
- Journal : notes libres horodatées, lien optionnel vers une pièce
- Partage public d'une entrée via `/s/[shareToken]` (sans login)
- Soft delete + corbeille (restauration / purge définitive)
- Médias photo + vidéo, stockés sur le disque local et servis par l'app (`/api/media`)
- PWA installable, mobile-first

## Documentation

Voir **[`HANDOFF.md`](./HANDOFF.md)** — architecture détaillée, API, modèle de
données, déploiement, état d'avancement et pistes.
