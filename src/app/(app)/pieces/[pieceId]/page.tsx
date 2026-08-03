import Link from "next/link";
import { notFound } from "next/navigation";
import { getPiece, getLinkTargets } from "@/lib/data";
import { PhotoAnnotator } from "@/components/PhotoAnnotator";
import type { EntryData } from "@/components/EntryCard";
import { PointsAccordion } from "@/components/PointsAccordion";
import type { LinkChip } from "@/components/CollapsiblePoint";
import { DeleteButton } from "@/components/DeleteButton";
import { LinkedJournalNotes } from "@/components/LinkedJournalNotes";
import { pointPreview, snippet } from "@/lib/pointPreview";
import { normalizePointLinks } from "@/lib/pointLinks";

export const dynamic = "force-dynamic";

export default async function PiecePage({ params }: { params: Promise<{ pieceId: string }> }) {
  const { pieceId } = await params;
  const piece = await getPiece(pieceId);
  if (!piece) notFound();

  const linkTargetsRaw = await getLinkTargets(piece.installationId);
  const linkTargets = linkTargetsRaw.map((pc) => ({
    pieceId: pc.id,
    pieceName: pc.name,
    points: pc.points.map((pt) => ({
      id: pt.id,
      num: pt.num,
      icon: pt.icon,
      title: snippet(pt.entries[pt.entries.length - 1]?.text ?? "", 44),
    })),
  }));

  const linksByPoint = new Map(piece.points.map((p) => [p.id, normalizePointLinks(p) as LinkChip[]]));

  const markers = piece.points.map((p) => {
    const { title, meta, thumb } = pointPreview(p.entries as unknown as { text: string; media: { type: string; url: string }[] }[]);
    const links = (linksByPoint.get(p.id) ?? []).map((c) => ({
      label: `${c.pieceName} · Point ${c.num}${c.label ? ` (${c.label})` : ""}`,
      href: `/pieces/${c.pieceId}#point-${c.pointId}`,
    }));
    return { id: p.id, num: p.num, x: p.x, y: p.y, icon: p.icon, title, meta, thumb, links };
  });

  return (
    <>
      <div className="topbar">
        <Link href={`/installations/${piece.installationId}`} className="back">
          ‹ {piece.installation.name}
        </Link>
      </div>
      <div className="topbar">
        <h1>{piece.name}</h1>
        <a className="btn ghost sm" href={`/api/pieces/${piece.id}/pdf`} target="_blank" rel="noreferrer">
          ⬇ PDF
        </a>
      </div>
      {piece.category && <div className="crumbs">{piece.category}</div>}

      <PhotoAnnotator pieceId={piece.id} photoUrl={piece.photoUrl} points={markers} />

      <div className="section-title">
        <span>Points ({piece.points.length})</span>
        <span className="line" />
      </div>

      {piece.points.length === 0 && (
        <p className="empty">Aucun point. Placez un point sur la photo, ou créez un point libre.</p>
      )}

      <PointsAccordion
        items={piece.points.map((point) => ({
          point: { id: point.id, num: point.num, x: point.x, y: point.y, icon: point.icon },
          entries: point.entries as unknown as EntryData[],
          links: linksByPoint.get(point.id) ?? [],
        }))}
        linkTargets={linkTargets}
      />

      <LinkedJournalNotes entries={piece.linkedEntries as unknown as EntryData[]} />

      <div className="danger-zone">
        <DeleteButton
          kind="piece"
          id={piece.id}
          label="🗑️ Supprimer la pièce"
          confirmText="Envoyer cette pièce à la corbeille ?"
          redirectTo={`/installations/${piece.installationId}`}
          className="btn ghost sm danger"
        />
      </div>
    </>
  );
}
