import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { absolutePathForKey, contentTypeForKey } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sert un fichier média depuis le disque local. Route PUBLIQUE (voir
// middleware) : nécessaire pour les pages de partage /s/[shareToken] et
// l'affichage général. Les clés contiennent un identifiant aléatoire.
// Supporte les requêtes Range (lecture/seek des vidéos).
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segs } = await ctx.params;
  if (!segs || segs.length === 0) return new Response("Not found", { status: 404 });

  const key = segs.join("/");
  let abs: string;
  try {
    abs = absolutePathForKey(key);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  let size: number;
  try {
    const st = await stat(abs);
    if (!st.isFile()) return new Response("Not found", { status: 404 });
    size = st.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const contentType = contentTypeForKey(key);
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const toWeb = (stream: Readable) => Readable.toWeb(stream) as NodeWebReadableStream<Uint8Array>;

  // Requête Range (ex. lecture vidéo) → 206 Partial Content.
  const range = req.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match) {
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new Response("Range non satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);
    return new Response(toWeb(createReadStream(abs, { start, end })) as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  return new Response(toWeb(createReadStream(abs)) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
