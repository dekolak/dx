import { route, NotFoundError } from "@/lib/api";
import { getPiece } from "@/lib/data";
import { buildPiecePdf, type PdfPiece } from "@/lib/pdf";
import { normalizePointLinks } from "@/lib/pointLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  const piece = await getPiece(id);
  if (!piece) throw new NotFoundError("Pièce introuvable");

  // Injecte les liaisons normalisées (repère correspondant) dans chaque point.
  const pdfPiece = {
    ...piece,
    points: piece.points.map((p) => ({
      ...p,
      links: normalizePointLinks(p).map((l) => ({ pieceName: l.pieceName, num: l.num, label: l.label })),
    })),
  };

  const pdf = await buildPiecePdf(pdfPiece as unknown as PdfPiece);
  const filename = `fiche-${(piece.name || "piece").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
