import "server-only";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Stockage média sur OVH Object Storage (API S3-compatible). Même pattern que
// `pose` : upload direct navigateur -> bucket via URL présignée, la base ne
// stocke que l'URL publique de l'objet.

const {
  S3_ENDPOINT,
  S3_REGION,
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_PUBLIC_BASE_URL,
} = process.env;

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 52428800); // 50 Mo

export function storageConfigured(): boolean {
  return Boolean(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!storageConfigured()) {
    throw new Error("Stockage OVH non configuré (variables S3_* manquantes).");
  }
  if (!_client) {
    _client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION || "gra",
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // OVH accepte le path-style, plus robuste
    });
  }
  return _client;
}

/** Nettoie un nom de fichier pour un usage sûr dans une clé S3. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
}

export function buildObjectKey(orgId: string, filename: string, rand: string): string {
  return `${orgId}/${rand}-${sanitizeFilename(filename)}`;
}

export function publicUrlForKey(key: string): string {
  const base = (S3_PUBLIC_BASE_URL || `${S3_ENDPOINT}/${S3_BUCKET}`).replace(/\/$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Génère une URL présignée PUT pour un upload direct depuis le navigateur.
 * Retourne aussi l'URL publique finale à enregistrer en base.
 */
export async function presignUpload(params: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    ACL: "public-read",
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 600 });
  return { uploadUrl, publicUrl: publicUrlForKey(params.key) };
}

/** Supprime définitivement un objet (purge corbeille). Best-effort. */
export async function deleteObjectByUrl(url: string): Promise<void> {
  const base = (S3_PUBLIC_BASE_URL || `${S3_ENDPOINT}/${S3_BUCKET}`).replace(/\/$/, "");
  if (!url.startsWith(base)) return; // URL externe / inconnue -> on ignore
  const key = decodeURIComponent(url.slice(base.length + 1));
  try {
    await client().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch {
    // Best-effort : ne bloque pas la purge si l'objet est déjà absent.
  }
}
