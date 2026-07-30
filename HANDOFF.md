# HANDOFF — App de référencement technique (`dx`)

Document de continuité de session (même pratique que sur `pose`). À lire en
début de session, à mettre à jour en fin de session.

---

## 1. Contexte

Application indépendante pour Teddy (DTS Conception / Lazzeko / Kiavik) :
centraliser les infos techniques sur les installations — une installation = une
machine seule OU un atelier entier (cartes mères, imprimantes,
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
| Stockage média | Disque local du VPS (volume Docker), servi par l'app via `/api/media` |
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
│   ├── storage.ts         # disque local : écriture, résolution chemin, delete
│   ├── api.ts             # wrapper route() + erreurs typées (400/401/404/500)
│   ├── data.ts            # LECTURES, TOUJOURS scopées organizationId (server components)
│   ├── mutations.ts       # ÉCRITURES, vérifient l'appartenance org avant de muter
│   └── client.ts          # helpers fetch + uploadFile (composants client)
├── app/
│   ├── (app)/             # pages protégées (layout = shell mobile + BottomNav)
│   │   ├── page.tsx                       # liste installations (actives)
│   │   ├── installations/page.tsx         # toutes les installations
│   │   ├── installations/[installationId]/ # pièces + software + fiche
│   │   ├── pieces/[pieceId]/page.tsx      # photo annotée + points empilés
│   │   ├── software/[softwareItemId]/     # timeline / changelog
│   │   ├── journal/page.tsx               # ajout rapide + notes
│   │   └── trash/page.tsx                 # corbeille (restore / purge)
│   ├── login/page.tsx     # hors groupe (app), public
│   ├── s/[shareToken]/     # page publique de partage, sans login
│   └── api/…              # route handlers (voir §6)
└── components/            # EntryCard, EntryComposer, EntryGallery,
                           # EntryDetailModal, CollapsiblePoint, PhotoAnnotator,
                           # Add*, etc.
```

**Invariant multi-tenant à ne jamais casser :** aucune lecture/écriture ne
touche Prisma sans passer par `data.ts` / `mutations.ts`, qui scopent par
`organizationId` (issu de la session). Les helpers de `mutations.ts` re-vérifient
l'appartenance (`assertInstallation`, `assertPiece`, …) AVANT toute mutation.

## 5. Modèle de données

Voir `prisma/schema.prisma`. Modèles : `Organization`, `User`, `Installation`,
`Piece`, `Point`, `SoftwareItem`, `Entry`, `Media`, `PhotoEnsemble`.

> **Vue d'ensemble** : une `Installation` peut avoir plusieurs `PhotoEnsemble`
> (photos globales / plan d'atelier). `Point` est **polymorphe** : son parent est
> soit une `Piece` (`pieceId`), soit une `PhotoEnsemble` (`photoEnsembleId`) —
> exactement un des deux (imposé côté appli). Un point d'ensemble avec
> `targetPieceId` est un **raccourci** (clic → `/pieces/[id]`) ; sans, c'est un
> **point d'info libre** avec ses propres entrées (comme un point virtuel).

> **Renommage Machine → Installation** : le concept de haut niveau s'appelle
> désormais « Installation » (une machine seule OU un atelier entier). Pour
> éviter toute migration de données, le modèle Prisma `Installation` est **mappé
> sur la table historique `Machine`** (`@@map("Machine")`), et les FK gardent le
> nom de colonne `machineId` (`@map`). Donc : côté code = `Installation` /
> `installationId` ; côté base = table `Machine` / colonne `machineId`. Le champ
> `machineRef` (« référence machine ») est un attribut, il garde son nom.

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
| `POST /api/installations`      | créer installation                          |
| `PATCH/DELETE /api/installations/[id]` | éditer / soft delete                |
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
| `DELETE /api/trash/[kind]/[id]`| purge définitive (+ suppression fichier média) |
| `POST /api/upload`             | upload fichier (corps brut) → disque local  |
| `GET  /api/media/[...path]`    | sert un média depuis le disque (public, Range) |

## 7. Stockage média (disque local)

Usage perso → pas de stockage objet externe. Le navigateur POST le fichier en
corps brut vers `POST /api/upload?filename=…` (streaming, avec limite de taille) ;
l'app l'écrit dans `UPLOAD_DIR` sous `<orgId>/<rand>-<fichier>`. La base stocke
l'URL applicative `/api/media/<clé>` (champ `Media.url`).

- **Service des fichiers** : route **publique** `GET /api/media/[...path]`
  (nécessaire pour les pages `/s/*` sans auth), avec garde anti-traversal,
  cache long et support des requêtes **Range** (lecture/seek vidéo). Les clés
  contiennent un identifiant aléatoire → URLs non devinables.
- **UPLOAD_DIR** : en prod, volume Docker persistant (ex. `/data/dx-uploads`,
  cf. `docs/COOLIFY.md` §3) ; en dev, dossier `.uploads` à la racine (gitignoré).
- Limite de taille : `MAX_UPLOAD_BYTES` (défaut 50 Mo). Images + vidéos.
- **Photos d'entrée : traitées côté client AVANT upload** (`MediaUploader` →
  `CropModal` + `lib/image.ts`) : éditeur de **recadrage** (rectangle ajustable),
  puis **redimensionnement** (plus grand côté ≤ 1600 px) + **compression JPEG**
  (q≈0.82), décodage orienté EXIF. Les vidéos passent sans traitement.
  ⚠️ La **photo principale annotée** (`AddPiece`, `PhotoAnnotator`) N'est PAS
  traitée (pleine résolution conservée pour le zoom précis).
- **Purge** : `deleteMediaByUrl` supprime le fichier sur disque.
- ⚠️ Le volume DOIT être persistant, sinon les médias disparaissent au
  redéploiement. Penser à l'inclure dans les backups VPS.
- `lib/storage.ts` : `saveStream`, `mediaUrlForKey`/`keyFromMediaUrl`,
  `absolutePathForKey` (garde traversal), `contentTypeForKey`.

## 8. Auth

- `authenticate(email, password)` → session `{ userId, organizationId, email }`
  signée en JWT (HS256, `SESSION_SECRET`) dans un cookie httpOnly (30 j).
- `middleware.ts` vérifie la signature (edge) et redirige vers `/login` / renvoie
  401 sur `/api/*`.
- **Cookie `Secure`** : actif par défaut en production (`cookieSecure()` dans
  `lib/auth.ts`). Un cookie `Secure` est refusé par le navigateur en HTTP → la
  session n'est pas conservée → boucle de redirection vers `/login`. Override
  temporaire : `COOKIE_SECURE=false` (le temps de brancher le HTTPS/Traefik),
  **à retirer une fois en HTTPS**. `COOKIE_SECURE=true` force l'inverse.
- Mono-user aujourd'hui (seed = Teddy) mais la structure accueille déjà
  plusieurs `User` par `Organization` (champ `role`). **Ne jamais coder en dur
  un utilisateur unique** dans la logique de requête.

## 9. Déploiement (Coolify)

> **Guide complet et copier-coller : [`docs/COOLIFY.md`](./docs/COOLIFY.md)**
> (service Postgres, variables d'env, **volume persistant médias**, seed).

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

### Sessions Claude Code on the web

Un hook `SessionStart` (`.claude/hooks/session-start.sh`, enregistré dans
`.claude/settings.json`) prépare automatiquement l'environnement des sessions
web (uniquement en distant, `CLAUDE_CODE_REMOTE=true`) : `npm install`, démarrage
de PostgreSQL, création + migration de la base `dx`, seed, puis export de
`DATABASE_URL` / `SESSION_SECRET` / `SEED_*` pour la session. Idempotent.
En local, on continue avec `docker compose up -d` + `.env`.

## 11. État actuel (au 2026-07-30)

**Déploiement :** PR #1 **mergée** dans `main` ; `main` = **branche par défaut**
sur GitHub ; **déploiement Coolify en cours** (relancé côté Teddy).

**Fait & validé** (build OK, typecheck OK, lint OK, smoke-test API end-to-end OK) :

- Scaffold Next.js + Prisma complet, schéma + migration `init` committée.
- Auth (login/logout/middleware), seed org+user.
- CRUD Installations / Pièces / Points / Software / Entries.
- Photo annotée avec placement de points (coords relatives) + points libres.
- Historique empilé par point ; « Corriger » vs « Ajouter une info » distincts.
- **Vue pièce compacte (mobile)** : points **repliables** (repliés par défaut :
  vignette + n° + titre court + compteurs ; dépliage au clic ; auto-ouverture
  via l'ancre `#point-<id>`), et **galerie de vignettes** par point — clic sur
  une vignette → modale de détail complet (réutilise `EntryCard`). Vérifié au
  viewport mobile (galerie, modale, pas de débordement horizontal).
- **Visionneuse photo (lightbox) pinch-to-zoom** (`ImageLightbox`) : cliquer une
  photo (aperçu du composer `MediaUploader`, ou média d'une entrée dans
  `EntryCard`) ouvre l'image en plein écran, zoomable (même moteur de gestes que
  la photo annotée). Corrige aussi l'aperçu du composer qui s'affichait en pleine
  taille (les vignettes font 74px, classe `.media-thumbs`). Vérifié mobile avec
  une photo 12 Mpx (vignette, lightbox contain, pinch 1→4.3×, fermeture).
- **Installation (ex-Machine) : champs** marque / modèle / réf. machine / réf.
  client (`InstallationEditForm`, fiche éditable) + **statut `active`**
  (`InstallationActiveToggle`). La vue principale (`/`) n'affiche que les
  installations actives ; les autres via `/installations` (« Toutes les
  installations »), avec bascule active/inactive.
- **Concept générique** : « Installation » représente une machine seule OU une
  infra/atelier.
- **Vue d'ensemble** (`OverviewSection`, `OverviewAnnotator`, `PhotoEnsemble`) :
  une ou plusieurs photos d'ensemble par installation, avec points — soit
  **raccourci** vers une Pièce (clic → sa fiche), soit **info libre** (accordéon
  + entrées). Réutilise `ZoomablePhoto` (moteur zoom/pan extrait de
  `PhotoAnnotator`), l'accordéon et les Entrées. Vérifié mobile de bout en bout
  (upload, point raccourci, point info, navigation, suppression/corbeille/restore).
- **Photos d'ensemble réordonnables + libellé éditable** : glisser-déposer
  tactile maison (`ReorderableList` — pointer events, poignée `≡` dédiée,
  `touch-action: none`, aperçu par insertion ; aucune dépendance) via le panneau
  `OverviewReorder` (affiché dès 2 photos) → `POST /api/photos-ensemble/reorder`.
  Libellé par photo éditable en place (`PATCH /api/photos-ensemble/[id]`, champ
  `label`). Vérifié mobile (drag tactile, persistance, édition libellé).
- **Accordéon des points** (`PointsAccordion`) : un seul point ouvert à la fois ;
  `CollapsiblePoint` est désormais contrôlé (open/onToggle).
- **Boutons Supprimer discrets** partout (`btn ghost sm/xs danger`, `.danger-zone`).
- **Recadrage + compression des photos d'entrée** (`CropModal`, `lib/image.ts`) :
  éditeur de crop tactile à l'ajout d'une photo dans une entrée, puis resize
  (≤1600px) + JPEG côté client. Vérifié avec une photo 12 Mpx (3024×4032) :
  crop appliqué, sortie 1600px max JPEG, ~1.8 Mpx (÷6.9), affichée. Photo
  principale annotée non traitée (pleine réso).
- **Photo annotée zoomable (mobile)** dans `PhotoAnnotator` : pincer pour
  zoomer, glisser pour déplacer, double-tap pour (dé)zoomer, bouton reset. Les
  pastilles gardent une **taille écran constante** (contre-scale `1/zoom` via la
  variable CSS `--inv-scale`) → plus précises vs la photo. Placement d'un point
  correct même zoomé : coords calculées depuis le **rect transformé de l'image**
  (`getBoundingClientRect` reflète zoom+pan) → jamais décalées. Moteur de gestes
  maison (Pointer Events, `touch-action: none`). Vérifié avec de **vrais gestes
  tactiles** (pinch/pan/tap via CDP) au viewport mobile : zoom 1→4.3×, pastille
  constante à 30px, point placé à Δ≈0 de la cible.
- Software timeline, Journal (ajout rapide + lien pièce optionnel).
- Partage public `/s/[shareToken]` (testé sans cookie).
- Soft delete + corbeille (restaurer / purger, purge = suppression fichier disque).
- **Stockage média sur disque local** : upload (streaming + limite de taille),
  service via `/api/media` (public, Range), purge, garde anti-traversal —
  **testé end-to-end** (upload → écriture disque → affichage → Range → purge,
  + rejets taille/type/traversal).
- PWA : manifest + service worker + icône SVG.
- Dockerfile + entrypoint + docker-compose + healthcheck.
- Doc déploiement `docs/COOLIFY.md` (dont volume persistant médias).
- Hook `SessionStart` pour les sessions web (voir §10).

**À faire / pistes :**

- **Config Coolify complète** (variables d'env + service Postgres + **volume
  persistant `UPLOAD_DIR`**) à saisir dans l'interface Coolify — côté Teddy,
  guide prêt dans `docs/COOLIFY.md`.
- Icônes PNG (192/512) en complément du SVG si un navigateur refuse le SVG à
  l'installation PWA.
- Compression/redimensionnement média côté client avant upload (perf mobile).
- Écran de gestion des comptes/organisations quand le multi-tenant sera activé.
- Tests automatisés (aucun pour l'instant).
- Optimisation image Docker (actuellement on copie tout `node_modules` pour
  disposer du CLI Prisma au démarrage ; possibilité de passer en `output:
  standalone` pur + step de migration séparé).

## 12. Gotchas

- **Pas de `output: "standalone"`** dans `next.config.mjs` : l'archi repose sur
  des node_modules complets + `next start` (pour garder le CLI Prisma au
  `migrate deploy` du démarrage). `next start` est **incompatible** avec le mode
  standalone (sinon 404 sur toutes les pages). Ne pas réactiver standalone sans
  aussi basculer l'entrypoint sur `node .next/standalone/server.js` ET régler la
  présence du CLI Prisma pour les migrations.
- Pages de données en `export const dynamic = "force-dynamic"` (pas de
  prerender au build → pas besoin de DB au build).
- Le service worker n'intercepte JAMAIS `/api/*` ni les navigations (réseau
  direct) pour éviter d'afficher des données périmées après une modif.
- `.env` n'est pas committé. Partir de `.env.example`.
