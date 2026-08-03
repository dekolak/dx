import { randomUUID } from "node:crypto";
import { route, ok, BadRequestError } from "@/lib/api";
import { requireOrgId } from "@/lib/auth";
import { buildKey, saveStream, mediaUrlForKey, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

// Upload direct navigateur -> disque local du VPS. Le fichier est envoyé en
// corps brut (streaming), avec le nom en query et le type via Content-Type.
// Retourne l'URL applicative (/api/media/...) à enregistrer en base.
export const POST = route(async (req) => {
  const organizationId = await requireOrgId();

  const params = new URL(req.url).searchParams;
  const filename = params.get("filename") || "file";
  const kind = params.get("kind"); // "file" = tout type (versions logiciel, docs)
  const contentType = req.headers.get("content-type") || "";
  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");
  // Par défaut on n'accepte que médias ; `kind=file` autorise n'importe quel type.
  if (kind !== "file" && !isImage && !isVideo) {
    throw new BadRequestError("Seuls les images et vidéos sont acceptées");
  }

  const declared = Number(req.headers.get("content-length") || 0);
  const tooBigMsg = `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} Mo)`;
  if (declared && declared > MAX_UPLOAD_BYTES) throw new BadRequestError(tooBigMsg);
  if (!req.body) throw new BadRequestError("Corps de requête vide");

  const key = buildKey(organizationId, filename, randomUUID().slice(0, 8));
  try {
    await saveStream(key, req.body, MAX_UPLOAD_BYTES);
  } catch (e) {
    if (e instanceof Error && e.message === "TOO_LARGE") throw new BadRequestError(tooBigMsg);
    throw e;
  }

  const type = kind === "file" && !isImage && !isVideo ? "file" : isVideo ? "video" : "photo";
  return ok({ url: mediaUrlForKey(key), type }, { status: 201 });
});
