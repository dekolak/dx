# Déploiement Coolify (VPS OVH)

Guide de configuration **à appliquer dans l'interface Coolify** (je n'ai pas
d'accès à ton instance — cette doc est le livrable « config »). Tout est
copier-coller.

## Vue d'ensemble

Deux ressources dans le même projet Coolify :

1. **Une base PostgreSQL** (ressource « Database » Coolify).
2. **L'application** `dx` (ressource « Application », build par `Dockerfile`).

Le conteneur applicatif applique les migrations au démarrage
(`prisma migrate deploy`, via `docker-entrypoint.sh`) puis lance Next.

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

### Variables d'environnement

À définir dans **Environment Variables** de l'application :

```bash
# Base de données (URL interne fournie par le service Postgres Coolify)
DATABASE_URL=postgresql://<user>:<password>@<service-name>:5432/<db>

# Session — générer une valeur longue : openssl rand -base64 48
SESSION_SECRET=<valeur-aléatoire-longue>

# Compte initial (créé par le seed, cf. §4). Change le mot de passe !
SEED_ORG_NAME=DTS Conception
SEED_USER_EMAIL=teddy@dekolak.fr
SEED_USER_PASSWORD=<mot-de-passe-fort>

# Stockage média OVH Object Storage (API S3-compatible)
S3_ENDPOINT=https://s3.gra.io.cloud.ovh.net
S3_REGION=gra
S3_BUCKET=dx-media
S3_ACCESS_KEY_ID=<clé-ovh>
S3_SECRET_ACCESS_KEY=<secret-ovh>
S3_PUBLIC_BASE_URL=https://dx-media.s3.gra.io.cloud.ovh.net

# Limite d'upload (octets) — 50 Mo
MAX_UPLOAD_BYTES=52428800
```

> Adapte la région (`gra`, `sbg`, `de`…) et l'endpoint à ton bucket OVH.
> `S3_PUBLIC_BASE_URL` = base d'URL publique des objets (ou un CDN devant le bucket).

---

## 3. Bucket OVH — lecture publique + CORS

L'app affiche les médias sur des pages publiques (`/s/[shareToken]`) et fait des
uploads **directs depuis le navigateur**. Deux prérequis sur le bucket :

1. **Lecture publique** des objets (les uploads posent déjà `ACL: public-read`,
   mais la policy du bucket doit l'autoriser).
2. **CORS** autorisant le `PUT` présigné depuis l'origine de l'app :

```json
[
  {
    "AllowedOrigins": ["https://dx.dekolak.fr"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

(Configurable via `aws s3api put-bucket-cors --endpoint-url $S3_ENDPOINT …`
avec les credentials OVH, ou via l'espace client OVH.)

### Vérifier avant de considérer que c'est bon

Depuis un environnement où les `S3_*` sont définies (ou avec un `.env` local) :

```bash
node scripts/test-upload.mjs
```

Le script teste : presign → PUT → **lecture publique** → nettoyage, et rappelle
la config CORS attendue. Le CORS navigateur se valide ensuite par un vrai upload
dans l'app (ajouter une photo à une entrée).

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
6. Vérifier l'upload OVH via `scripts/test-upload.mjs` + un upload réel dans l'app.
