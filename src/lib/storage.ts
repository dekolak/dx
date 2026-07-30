import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import path from "node:path";

// Stockage média sur le DISQUE LOCAL du VPS (monté en volume Docker en prod).
// L'app écrit les fichiers dans UPLOAD_DIR et les sert elle-même via la route
// /api/media/[...path]. La base ne stocke que l'URL applicative de l'objet.
// (Remplace l'ancien stockage OVH S3 — inutile pour un usage perso.)

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 52428800); // 50 Mo

// En prod : volume Docker (ex. /data/dx-uploads). En dev : dossier local du repo.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), ".uploads");

const MEDIA_URL_PREFIX = "/api/media/";

/** Nettoie un nom de fichier pour un usage sûr dans une clé. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
}

export function buildKey(orgId: string, filename: string, rand: string): string {
  // orgId vient de la session (cuid), rand est aléatoire → pas de traversal.
  return `${orgId}/${rand}-${sanitizeFilename(filename)}`;
}

/** URL applicative servie par /api/media (stockée en base comme `Media.url`). */
export function mediaUrlForKey(key: string): string {
  return MEDIA_URL_PREFIX + key.split("/").map(encodeURIComponent).join("/");
}

/** Clé de stockage à partir d'une URL /api/media/... (null si non gérée). */
export function keyFromMediaUrl(url: string): string | null {
  if (!url.startsWith(MEDIA_URL_PREFIX)) return null;
  return url
    .slice(MEDIA_URL_PREFIX.length)
    .split("/")
    .map((s) => decodeURIComponent(s))
    .join("/");
}

/** Chemin absolu sur disque pour une clé, avec garde anti-traversal. */
export function absolutePathForKey(key: string): string {
  const root = path.resolve(UPLOAD_DIR);
  const abs = path.resolve(root, key);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error("Chemin média invalide");
  }
  return abs;
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

export function contentTypeForKey(key: string): string {
  return MIME[path.extname(key).toLowerCase()] || "application/octet-stream";
}

/**
 * Écrit un flux (corps de requête) sur disque, en imposant une taille max.
 * Lève `Error("TOO_LARGE")` et nettoie le fichier partiel si la limite est
 * dépassée. Retourne le nombre d'octets écrits.
 */
export async function saveStream(
  key: string,
  webStream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<number> {
  const abs = absolutePathForKey(key);
  await mkdir(path.dirname(abs), { recursive: true });
  const out = createWriteStream(abs);
  let bytes = 0;
  try {
    const nodeStream = Readable.fromWeb(webStream as unknown as NodeWebReadableStream<Uint8Array>);
    for await (const chunk of nodeStream) {
      bytes += (chunk as Buffer).length;
      if (bytes > maxBytes) throw new Error("TOO_LARGE");
      if (!out.write(chunk)) await new Promise<void>((res) => out.once("drain", () => res()));
    }
    await new Promise<void>((res, rej) => out.end((err?: Error | null) => (err ? rej(err) : res())));
  } catch (e) {
    out.destroy();
    await unlink(abs).catch(() => {});
    throw e;
  }
  return bytes;
}

/** Chemin disque local d'une URL /api/media/... (null si externe/inconnue). */
export function localPathForMediaUrl(url: string): string | null {
  const key = keyFromMediaUrl(url);
  if (!key) return null;
  try {
    return absolutePathForKey(key);
  } catch {
    return null;
  }
}

/** Supprime le fichier correspondant à une URL média (purge). Best-effort. */
export async function deleteMediaByUrl(url: string): Promise<void> {
  const key = keyFromMediaUrl(url);
  if (!key) return; // URL externe / inconnue
  try {
    await unlink(absolutePathForKey(key));
  } catch {
    // Best-effort : ne bloque pas la purge si le fichier est déjà absent.
  }
}
