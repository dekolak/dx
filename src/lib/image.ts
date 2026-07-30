"use client";

// Traitement d'image côté client (avant upload) pour les photos d'ENTRÉE :
// décodage orienté (EXIF), recadrage, redimensionnement et compression JPEG.
// La photo principale annotée n'utilise PAS ce module (elle reste pleine réso).

export type SourceCrop = { sx: number; sy: number; sw: number; sh: number };

/** Décode un fichier image en appliquant l'orientation EXIF (photos téléphone). */
export async function decodeOriented(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Recadre + redimensionne (borne le plus grand côté à maxDim) + compresse en
 * JPEG. `crop` est exprimé en pixels de l'image source (déjà orientée).
 */
export async function exportCropJpeg(
  bmp: ImageBitmap,
  crop: SourceCrop,
  maxDim = 1600,
  quality = 0.82,
): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(crop.sw, crop.sh));
  const outW = Math.max(1, Math.round(crop.sw * scale));
  const outH = Math.max(1, Math.round(crop.sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob a échoué"))), "image/jpeg", quality),
  );
}

/** Renomme un fichier avec l'extension .jpg. */
export function jpegName(original: string): string {
  return original.replace(/\.[^./\\]+$/, "") + ".jpg";
}
