import Link from "next/link";
import { notFound } from "next/navigation";
import { getPiece, getLinkTargets } from "@/lib/data";
import { PhotoAnnotator } from "@/components/PhotoAnnotator";
import type { EntryData } from "@/components/EntryCard";
import { PointsAccordion } from "@/components/PointsAccordion";
import type { LinkChip } from "@/components/CollapsiblePoint";
import { DeleteButton } from "@/components/DeleteButton";
import { pointPreview, snippet } from "@/lib/pointPreview";

export const dynamic = "force-dynamic";

// Normalise les liaisons d'un point (deux sens) en puces prêtes à afficher,
// en écartant les repères / pièces supprimés.
type PointWithLinks = Awaited<ReturnType<typeof getPiece>> extends infer T
  ? T extends { points: (infer P)[] }
    ? P
    : never
  : never;
function linksOf(p: NonNullable<PointWithLinks>): LinkChip[] {
  const raw = [
    ...p.linksA.map((l) => ({ linkId: l.id, label: l.label, other: l.bPoint })),
    ...p.linksB.map((l) => ({ linkId: l.id, label: l.label, other: l.aPoint })),
  ];
  return raw
    .filter((r) => r.other && !r.other.deletedAt && r.other.piece && !r.other.piece.deletedAt)
    .map((r) => ({
      linkId: r.linkId,
      label: r.label,
      pointId: r.other.id,
      num: r.other.num,
      icon: r.other.icon,
      pieceId: r.other.piece!.id,
      pieceName: r.other.piece!.name,
    }));
}

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

  const linksByPoint = new Map(piece.points.map((p) => [p.id, linksOf(p)]));

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
