import { route, NotFoundError } from "@/lib/api";
import { getPiece } from "@/lib/data";
import { buildPiecePdf, type PdfPiece } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  const piece = await getPiece(id);
  if (!piece) throw new NotFoundError("Pièce introuvable");

  const pdf = await buildPiecePdf(piece as unknown as PdfPiece);
  const filename = `fiche-${(piece.name || "piece").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
