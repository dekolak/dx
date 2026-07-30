import "server-only";
import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import { localPathForMediaUrl } from "@/lib/storage";

// Export PDF d'une fiche Pièce : gabarit fixe et simple.
//  1. En-tête : photo annotée + pastilles numérotées (dessinées en vectoriel aux
//     coordonnées relatives des points → net et fidèle à l'app).
//  2. En cascade : chaque point (ordre num) — n° + dernière info, puis ses
//     entrées (date, texte, photos jointes).

const ACCENT = "#4f8cff";

type Media = { url: string; type: string };
type Entry = { createdAt: Date | string; text: string; media: Media[] };
type Point = { num: number; x: number | null; y: number | null; entries: Entry[] };
export type PdfPiece = {
  name: string;
  category: string | null;
  photoUrl: string | null;
  installation: { name: string };
  points: Point[];
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function snippet(t: string, n = 90) {
  const s = t.trim().replace(/\s+/g, " ");
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
function readImage(url: string): Buffer | null {
  const p = localPathForMediaUrl(url);
  if (!p) return null;
  try {
    return readFileSync(p);
  } catch {
    return null;
  }
}

type Doc = InstanceType<typeof PDFDocument>;

function drawMarker(doc: Doc, cx: number, cy: number, num: number) {
  const r = 9;
  doc.save();
  doc.circle(cx, cy, r).lineWidth(1.5).fillAndStroke(ACCENT, "#ffffff");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  doc.text(String(num), cx - r, cy - 4.5, { width: 2 * r, align: "center", lineBreak: false });
  doc.restore();
}

export async function buildPiecePdf(piece: PdfPiece): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Fiche pièce — ${piece.name}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (needed: number) => {
    if (doc.y + needed > bottom()) doc.addPage();
  };
  // `openImage` existe au runtime (pdfkit) mais n'est pas dans @types/pdfkit.
  const openImage = (buf: Buffer) =>
    (doc as unknown as { openImage: (b: Buffer) => { width: number; height: number } }).openImage(buf);
  const placeImage = (buf: Buffer, maxW: number) => {
    const img = openImage(buf);
    const scale = maxW / img.width;
    const h = img.height * scale;
    return { img, w: maxW, h };
  };

  // --- Titre ---
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111").text(piece.name);
  doc.font("Helvetica").fontSize(10).fillColor("#666").text(`${piece.installation.name}${piece.category ? ` · ${piece.category}` : ""}`);
  doc.moveDown(0.6);

  // --- Photo annotée + pastilles ---
  if (piece.photoUrl) {
    const buf = readImage(piece.photoUrl);
    if (buf) {
      try {
        const { img, w, h } = placeImage(buf, contentW);
        if (doc.y + h > bottom()) doc.addPage();
        const x = left;
        const y = doc.y;
        doc.image(img as unknown as Buffer, x, y, { width: w });
        for (const pt of piece.points) {
          if (pt.x == null || pt.y == null) continue;
          drawMarker(doc, x + pt.x * w, y + pt.y * h, pt.num);
        }
        doc.y = y + h;
        doc.moveDown(0.8);
      } catch {
        /* image illisible → on saute l'en-tête image */
      }
    }
  }

  // --- Points en cascade ---
  for (const pt of piece.points) {
    ensureSpace(70);
    doc.moveTo(left, doc.y).lineTo(left + contentW, doc.y).strokeColor("#e2e2e2").lineWidth(1).stroke();
    doc.moveDown(0.4);

    const latest = pt.entries[pt.entries.length - 1];
    const title = latest ? snippet(latest.text) || "(média)" : "Aucune info";
    doc.font("Helvetica-Bold").fontSize(13).fillColor(ACCENT).text(`Point ${pt.num}`, left, doc.y, { continued: true });
    doc.font("Helvetica").fontSize(11).fillColor("#333").text(`${pt.x == null ? "  (libre)" : ""}  —  ${title}`);
    doc.x = left; // le `continued` a laissé le curseur avancé → on le remet à la marge
    doc.moveDown(0.25);

    if (pt.entries.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#999").text("Aucune info pour ce point.", left, doc.y, { width: contentW });
    }
    for (const e of pt.entries) {
      ensureSpace(26);
      doc.font("Helvetica").fontSize(8).fillColor("#999").text(fmtDate(e.createdAt), left, doc.y, { width: contentW });
      if (e.text) doc.font("Helvetica").fontSize(10.5).fillColor("#111").text(e.text, left, doc.y, { width: contentW });
      for (const m of e.media) {
        if (m.type !== "photo") {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#999").text("[vidéo — non incluse dans le PDF]");
          continue;
        }
        const mbuf = readImage(m.url);
        if (!mbuf) continue;
        try {
          const { img, w, h } = placeImage(mbuf, Math.min(contentW, 300));
          ensureSpace(h + 6);
          doc.image(img as unknown as Buffer, left, doc.y, { width: w });
          doc.y = doc.y + h + 4;
        } catch {
          /* média illisible → on saute */
        }
      }
      doc.moveDown(0.4);
    }
    doc.moveDown(0.3);
  }

  doc.end();
  return done;
}
