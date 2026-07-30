// Self-test du flux média OVH Object Storage : presign PUT -> upload -> lecture
// publique -> (nettoyage). À lancer LÀ OÙ les variables S3_* sont définies
// (env Coolify, ou .env local). Les secrets ne transitent jamais par le chat.
//
//   node scripts/test-upload.mjs
//
// Sortie : PASS/FAIL pour chaque étape (presign, PUT, lecture publique, CORS).

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFileSync } from "node:fs";

// Charge .env si présent (sans dépendance : parsing minimal).
try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* pas de .env : on lit l'environnement tel quel */
}

const {
  S3_ENDPOINT,
  S3_REGION = "gra",
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_PUBLIC_BASE_URL,
} = process.env;

function fail(msg, err) {
  console.error(`❌ ${msg}`);
  if (err) console.error("   →", err.message || err);
  process.exit(1);
}
function pass(msg) {
  console.log(`✅ ${msg}`);
}

for (const [k, v] of Object.entries({ S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY })) {
  if (!v) fail(`Variable ${k} manquante`);
}

const client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

const key = `__selftest__/${Date.now()}-test.txt`;
const body = `dx upload self-test ${new Date().toISOString()}`;
const publicBase = (S3_PUBLIC_BASE_URL || `${S3_ENDPOINT}/${S3_BUCKET}`).replace(/\/$/, "");
const publicUrl = `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;

console.log(`Bucket   : ${S3_BUCKET}`);
console.log(`Endpoint : ${S3_ENDPOINT}`);
console.log(`Clé test : ${key}\n`);

// 1. Presign PUT (exactement comme l'API /api/upload).
let uploadUrl;
try {
  uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: "text/plain", ACL: "public-read" }),
    { expiresIn: 600 },
  );
  pass("Presign PUT généré");
} catch (e) {
  fail("Échec du presign (credentials / endpoint ?)", e);
}

// 2. Upload via l'URL présignée (comme le navigateur).
try {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain", "x-amz-acl": "public-read" },
    body,
  });
  if (!res.ok) fail(`PUT présigné refusé : HTTP ${res.status} ${await res.text()}`);
  pass("Upload PUT présigné accepté");
} catch (e) {
  fail("Échec de l'upload PUT", e);
}

// 3. Lecture publique (indispensable pour les pages /s/[shareToken]).
try {
  const res = await fetch(publicUrl);
  if (res.status === 403 || res.status === 401) {
    fail(`Objet NON lisible publiquement (HTTP ${res.status}). Le bucket doit être en lecture publique.`);
  }
  if (!res.ok) fail(`Lecture publique KO : HTTP ${res.status}`);
  const text = await res.text();
  if (text !== body) fail("Contenu lu != contenu envoyé");
  pass(`Lecture publique OK : ${publicUrl}`);
} catch (e) {
  fail("Échec de la lecture publique", e);
}

// 4. Rappel CORS (non testable côté serveur : c'est un contrôle navigateur).
console.log(
  "\nℹ️  CORS : ce script fait un PUT server-to-server, il ne vérifie pas le CORS.",
);
console.log(
  "   Le navigateur exige que le bucket autorise PUT depuis l'origine de l'app.",
);
console.log("   Config CORS attendue sur le bucket (voir docs/COOLIFY.md) :");
console.log('   AllowedOrigins=["https://<domaine-app>"], AllowedMethods=["PUT","GET"], AllowedHeaders=["*"]');

// 5. Nettoyage.
try {
  await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  pass("Objet de test supprimé");
} catch (e) {
  console.warn("⚠️  Nettoyage échoué (objet de test à supprimer manuellement) :", e.message);
}

console.log("\n🎉 Flux serveur OK. Reste à valider le CORS depuis le navigateur (upload réel dans l'app).");
