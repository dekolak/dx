import { randomUUID } from "node:crypto";
import { route, readJson, ok, BadRequestError } from "@/lib/api";
import { requireOrgId } from "@/lib/auth";
import { presignUpload, buildObjectKey, storageConfigured, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

// Retourne une URL présignée pour un upload direct navigateur -> OVH.
export const POST = route(async (req) => {
  const organizationId = await requireOrgId();
  if (!storageConfigured()) throw new BadRequestError("Stockage média non configuré sur ce serveur");

  const { filename, contentType, size } = await readJson<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>(req);

  if (!filename || !contentType) throw new BadRequestError("filename et contentType requis");
  if (typeof size === "number" && size > MAX_UPLOAD_BYTES) {
    throw new BadRequestError(`Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} Mo)`);
  }
  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");
  if (!isImage && !isVideo) throw new BadRequestError("Seuls les images et vidéos sont acceptées");

  const key = buildObjectKey(organizationId, filename, randomUUID().slice(0, 8));
  const { uploadUrl, publicUrl } = await presignUpload({ key, contentType });
  return ok({ uploadUrl, publicUrl, mediaType: isVideo ? "video" : "photo" });
});
