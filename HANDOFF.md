# HANDOFF — App de référencement technique (`dx`)

Document de continuité de session (même pratique que sur `pose`). À lire en
début de session, à mettre à jour en fin de session.

---

## 1. Contexte

Application indépendante pour Teddy (DTS Conception / Lazzeko / Kiavik) :
centraliser les infos techniques sur les machines (cartes mères, imprimantes,
laser, plasma…) — photos annotées, historique logiciel, notes rapides.
**Usage mobile prioritaire (atelier).**

- Repo neuf, **indépendant** du monorepo `dekolak/pose`. Mêmes standards de
  code, code et déploiement totalement séparés.
- Mono-utilisateur aujourd'hui, mais le **modèle de données supporte déjà
  plusieurs organisations isolées** (`organizationId` partout) pour un futur
  SaaS multi-clients sans refonte.

## 2. Stack

| Élément      | Choix                                                        |
| ------------ | ------------------------------------------------------------ |
| Framework    | Next.js 15 (App Router) — front + API routes                 |
| ORM / DB     | Prisma 6 + PostgreSQL                                         |
| Stockage média | OVH Object Storage (API S3-compatible), upload direct présigné |
| Déploiement  | Coolify sur le VPS OVH, repo GitHub dédié (`dekolak/dx`)      |
| PWA          | manifest + service worker (`public/sw.js`), installable mobile |
| Auth         | email + mot de passe → cookie de session JWT (`jose`)        |

## 3. Concept central : le bloc « Entry »

Un seul modèle `Entry` réutilisé partout (Point, Software, Journal) :
texte + médias + date + partage + soft delete. Discriminé par `type`
(`point | software | journal`) et rattaché via `pointId` / `softwareItemId` /
`linkedPieceId`.

**Règle de versioning (implémentée dans l'UI, à préserver) :**

- **Corriger** = éditer l'entrée existante (coquille). → `PATCH /api/entries/[id]`
  (`correctEntry`). Bouton « ✏️ Corriger » dans `EntryCard`.
- **Ajouter une info** = nouvelle entrée EMPILÉE, jamais d'écrasement de
  l'historique. → `POST /api/entries` (`createEntry`). Composant `EntryComposer`.

Ces deux actions sont **volontairement distinctes** dans l'interface.

## 4. Architecture du code

```
src/
├── middleware.ts          # protège tout sauf /login, /s/*, /api/auth, /api/health, assets
├── lib/
│   ├── prisma.ts          # singleton PrismaClient
│   ├── auth.ts            # session JWT, authenticate, requireOrgId
│   ├── storage.ts         # OVH S3 : presign PUT, URL publique, delete
│   ├── api.ts             # wrapper route() + erreurs typées (400/401/404/500)
│   ├── data.ts            # LECTURES, TOUJOURS scopées organizationId (server components)
│   ├── mutations.ts       # ÉCRITURES, vérifient l'appartenance org avant de muter
│   └── client.ts          # helpers fetch + uploadFile (composants client)
├── app/
│   ├── (app)/             # pages protégées (layout = shell mobile + BottomNav)
│   │   ├── page.tsx                       # liste machines
│   │   ├── machines/[machineId]/page.tsx  # pièces + software
│   │   ├── pieces/[pieceId]/page.tsx      # photo annotée + points empilés
│   │   ├── software/[softwareItemId]/     # timeline / changelog
│   │   ├── journal/page.tsx               # ajout rapide + notes
│   │   └── trash/page.tsx                 # corbeille (restore / purge)
│   ├── login/page.tsx     # hors groupe (app), public
│   ├── s/[shareToken]/     # page publique de partage, sans login
│   └── api/…              # route handlers (voir §6)
└── components/            # Entry, EntryComposer, PhotoAnnotator, Add*, etc.
```

**Invariant multi-tenant à ne jamais casser :** aucune lecture/écriture ne
touche Prisma sans passer par `data.ts` / `mutations.ts`, qui scopent par
`organizationId` (issu de la session). Les helpers de `mutations.ts` re-vérifient
l'appartenance (`assertMachine`, `assertPiece`, …) AVANT toute mutation.

## 5. Modèle de données

Voir `prisma/schema.prisma`. Modèles : `Organization`, `User`, `Machine`,
`Piece`, `Point`, `SoftwareItem`, `Entry`, `Media`.

- Soft delete partout via `deletedAt` (corbeille + restauration + purge).
- `Entry.shareToken` unique, généré à l'activation du partage.
- `Point.x/y` nullable → « point libre / virtuel » (créé juste pour partager au
  client, sans coordonnées réelles sur la photo).
- `Point.num` : numérotation continue par pièce (max+1, soft-deleted inclus pour
  éviter les collisions d'affichage).
- Cascades `onDelete: Cascade` → la purge d'un parent nettoie les enfants.

## 6. API (route handlers, tous en `runtime = nodejs`)

| Méthode + route                | Rôle                                        |
| ------------------------------ | ------------------------------------------- |
| `POST /api/auth/login`         | login → cookie session                      |
| `POST /api/auth/logout`        | logout                                      |
| `GET  /api/health`             | healthcheck (public)                        |
| `POST /api/machines`           | créer machine                               |
| `PATCH/DELETE /api/machines/[id]` | éditer / soft delete                     |
| `POST /api/pieces`             | créer pièce (photoUrl optionnel)            |
| `PATCH/DELETE /api/pieces/[id]`| éditer (dont photoUrl) / soft delete        |
| `POST /api/points`             | créer point (x,y optionnels)                |
| `PATCH/DELETE /api/points/[id]`| repositionner / soft delete                 |
| `POST /api/software`           | créer software item                         |
| `DELETE /api/software/[id]`    | soft delete                                 |
| `POST /api/entries`            | **Ajouter une info** (nouvelle entrée)      |
| `PATCH /api/entries/[id]`      | **Corriger** (édition en place)             |
| `DELETE /api/entries/[id]`     | soft delete                                 |
| `POST /api/entries/[id]/share` | activer/désactiver partage                  |
| `POST /api/trash/[kind]/[id]`  | restaurer                                   |
| `DELETE /api/trash/[kind]/[id]`| purge définitive (+ suppression média OVH)  |
| `POST /api/upload`             | URL présignée d'upload direct vers OVH      |

## 7. Stockage média (OVH)

Pattern identique à `pose` : le navigateur demande une URL présignée
(`POST /api/upload`), puis fait un `PUT` direct vers le bucket. La base ne
stocke que l'URL publique de l'objet.

- Bucket attendu **en lecture publique** (pour que les pages `/s/*` affichent
  les médias sans auth). L'upload pose `ACL: public-read`.
- Limite de taille : `MAX_UPLOAD_BYTES` (défaut 50 Mo). Images + vidéos.
- Variables : `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`. Voir `.env.example`.

## 8. Auth

- `authenticate(email, password)` → session `{ userId, organizationId, email }`
  signée en JWT (HS256, `SESSION_SECRET`) dans un cookie httpOnly (30 j).
- `middleware.ts` vérifie la signature (edge) et redirige vers `/login` / renvoie
  401 sur `/api/*`.
- Mono-user aujourd'hui (seed = Teddy) mais la structure accueille déjà
  plusieurs `User` par `Organization` (champ `role`). **Ne jamais coder en dur
  un utilisateur unique** dans la logique de requête.

## 9. Déploiement (Coolify)

> **Guide complet et copier-coller : [`docs/COOLIFY.md`](./docs/COOLIFY.md)**
> (service Postgres, variables d'env, CORS/lecture publique du bucket, seed).
> Vérif upload OVH : `node scripts/test-upload.mjs`.

- `Dockerfile` multi-stage (node:22-slim, openssl pour Prisma).
- `docker-entrypoint.sh` : `prisma migrate deploy` puis `next start`.
- Port `3000`. Healthcheck : `GET /api/health`.
- Config Coolify : application Dockerfile, variables d'env du `.env.example`,
  base Postgres provisionnée à part (service Coolify ou OVH managé).
- `binaryTargets = ["native", "debian-openssl-3.0.x"]` dans le schéma pour le
  moteur Prisma en image Debian.

## 10. Commandes utiles

```bash
npm run dev            # dev local (http://localhost:3000)
npm run build          # prisma generate + next build
npm run typecheck      # tsc --noEmit
npm run lint
npm run prisma:migrate # prisma migrate dev
npm run prisma:deploy  # migrations en prod
npm run db:seed        # crée org + user (SEED_* dans .env)
docker compose up -d   # Postgres local
```

## 11. État actuel (au 2026-07-30)

**Fait & validé** (build OK, typecheck OK, smoke-test API end-to-end OK) :

- Scaffold Next.js + Prisma complet, schéma + migration `init` committée.
- Auth (login/logout/middleware), seed org+user.
- CRUD Machines / Pièces / Points / Software / Entries.
- Photo annotée avec placement de points (coords relatives) + points libres.
- Historique empilé par point ; « Corriger » vs « Ajouter une info » distincts.
- Software timeline, Journal (ajout rapide + lien pièce optionnel).
- Partage public `/s/[shareToken]` (testé sans cookie).
- Soft delete + corbeille (restaurer / purger, purge = delete média OVH).
- Upload média présigné OVH (code prêt ; non testé contre un vrai bucket).
- PWA : manifest + service worker + icône SVG.
- Dockerfile + entrypoint + docker-compose + healthcheck.

**À faire / pistes :**

- **Tester l'upload contre un vrai bucket OVH** — flux presign→PUT→URL publique
  codé mais **non exécuté contre OVH** (aucune clé fournie à ce stade). Lancer
  `node scripts/test-upload.mjs` avec les `S3_*` définies, puis un upload réel
  dans l'app pour valider le CORS navigateur. Cf. `docs/COOLIFY.md` §3.
- Icônes PNG (192/512) en complément du SVG si un navigateur refuse le SVG à
  l'installation PWA.
- Compression/redimensionnement média côté client avant upload (perf mobile).
- Écran de gestion des comptes/organisations quand le multi-tenant sera activé.
- Tests automatisés (aucun pour l'instant).
- Optimisation image Docker (actuellement on copie tout `node_modules` pour
  disposer du CLI Prisma au démarrage ; possibilité de passer en `output:
  standalone` pur + step de migration séparé).

## 12. Gotchas

- `output: "standalone"` est activé dans `next.config.mjs` mais le Dockerfile
  utilise `next start` classique (node_modules complets) pour garder le CLI
  Prisma pour les migrations. Cohérent, juste bon à savoir.
- Pages de données en `export const dynamic = "force-dynamic"` (pas de
  prerender au build → pas besoin de DB au build).
- Le service worker n'intercepte JAMAIS `/api/*` ni les navigations (réseau
  direct) pour éviter d'afficher des données périmées après une modif.
- `.env` n'est pas committé. Partir de `.env.example`.
