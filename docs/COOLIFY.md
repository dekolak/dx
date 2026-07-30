# Déploiement Coolify (VPS OVH)

Guide de configuration **à appliquer dans l'interface Coolify** (je n'ai pas
d'accès à ton instance — cette doc est le livrable « config »). Tout est
copier-coller.

## Vue d'ensemble

Deux ressources dans le même projet Coolify :

1. **Une base PostgreSQL** (ressource « Database » Coolify).
2. **L'application** `dx` (ressource « Application », build par `Dockerfile`),
   avec un **volume persistant** pour les médias (voir §3).

Le conteneur applicatif applique les migrations au démarrage
(`prisma migrate deploy`, via `docker-entrypoint.sh`) puis lance Next. Les
médias (photos/vidéos) sont stockés **sur le disque local** (volume Docker) et
servis par l'app via `/api/media` — pas de stockage objet externe.

---

## 1. Service PostgreSQL

Dans le projet Coolify → **+ New Resource → Database → PostgreSQL** (v16).

- Note le nom d'utilisateur, le mot de passe et le nom de base générés.
- Coolify expose une URL interne du type
  `postgresql://<user>:<password>@<service-name>:5432/<db>`.
- Le réseau interne Coolify permet à l'app de joindre la base par son
  **nom de service** (pas besoin d'exposer un port public).

➡️ Récupère l'URL de connexion interne : ce sera `DATABASE_URL` côté app.

---

## 2. Application `dx`

**+ New Resource → Application → depuis le repo GitHub `dekolak/dx`.**

| Réglage            | Valeur                                                    |
| ------------------ | --------------------------------------------------------- |
| Branch             | `main` (après merge de la PR)                             |
| Build Pack         | **Dockerfile**                                            |
| Dockerfile         | `./Dockerfile` (défaut)                                   |
| Port exposé        | `3000`                                                    |
| Health check path  | `/api/health`                                             |
| Domaine            | ton domaine (ex : `dx.dekolak.fr`) — HTTPS via Coolify    |

> **Réseau au build :** l'étape `npm ci` télécharge le moteur Prisma
> (`libquery_engine-debian-openssl-3.0.x`) depuis le CDN Prisma. Le builder
> Coolify doit avoir un **accès réseau sortant** (c'est le cas par défaut). Si
> l'egress vers `binaries.prisma.sh` est bloqué, définir un miroir via la
> variable de build `PRISMA_ENGINES_MIRROR`.

### Variables d'environnement

À définir dans **Environment Variables** de l'application :

```bash
# Base de données (URL interne fournie par le service Postgres Coolify)
DATABASE_URL=postgresql://<user>:<password>@<service-name>:5432/<db>

# Session — générer une valeur longue : openssl rand -base64 48
SESSION_SECRET=<valeur-aléatoire-longue>

# ⚠️ TEMPORAIRE : décommenter pour se connecter en HTTP (cookie sans Secure),
# le temps de régler le HTTPS/Traefik. À RETIRER dès que le HTTPS est en place.
# COOKIE_SECURE=false

# Compte initial (créé par le seed, cf. §4). Change le mot de passe !
SEED_ORG_NAME=DTS Conception
SEED_USER_EMAIL=teddy@dekolak.fr
SEED_USER_PASSWORD=<mot-de-passe-fort>

# Stockage média — disque local. Doit pointer vers le volume persistant (§3).
UPLOAD_DIR=/data/dx-uploads

# Limite d'upload (octets) — 50 Mo
MAX_UPLOAD_BYTES=52428800
```

---

## 3. Volume persistant pour les médias

Les photos/vidéos sont écrites sur le disque local et **doivent survivre aux
redéploiements** → un volume persistant est indispensable (sinon les médias
disparaissent à chaque rebuild du conteneur).

Dans l'application Coolify → **Storages → + Add → Volume Mount** (Persistent
Storage) :

| Réglage                    | Valeur                        |
| -------------------------- | ----------------------------- |
| Name                       | `dx-uploads`                  |
| Destination Path (conteneur) | `/data/dx-uploads`          |
| Source (host, optionnel)   | ex. `/data/dx-uploads` sur le VPS |

Puis s'assurer que la variable d'env **`UPLOAD_DIR=/data/dx-uploads`** pointe sur
ce même chemin **dans le conteneur** (Destination Path).

- L'app crée les sous-dossiers (`<orgId>/…`) automatiquement au premier upload.
- Les médias sont servis par la route **publique** `/api/media/[...]` (nécessaire
  pour les pages de partage `/s/[shareToken]`). Les clés contiennent un
  identifiant aléatoire → URLs non devinables.
- Sauvegarde : inclure `/data/dx-uploads` (côté host) dans tes backups VPS.

### Vérifier après déploiement

Un simple test dans l'app suffit : se connecter, ajouter une photo à une entrée,
vérifier qu'elle s'affiche, puis redéployer et confirmer qu'elle est toujours là
(volume persistant OK).

---

## 4. Compte initial (seed)

À faire **une fois**, après le premier déploiement (les migrations, elles, sont
appliquées automatiquement au démarrage).

Dans un terminal du conteneur applicatif (Coolify → **Execute Command**) :

```bash
npm run db:seed
```

Crée l'organisation + l'utilisateur à partir de `SEED_*`. Idempotent (ne
recrée pas si l'email existe déjà). Connexion ensuite avec
`SEED_USER_EMAIL` / `SEED_USER_PASSWORD`.

---

## 5. Récapitulatif du cycle de déploiement

1. Merge de la PR sur `main`.
2. Coolify build l'image (`Dockerfile`) et déploie.
3. Au démarrage : `prisma migrate deploy` puis `next start` (port 3000).
4. Healthcheck sur `/api/health`.
5. (Premier déploiement uniquement) `npm run db:seed`.
6. Vérifier qu'un volume persistant est monté sur `UPLOAD_DIR` (§3), puis tester
   un upload + affichage réel dans l'app.
