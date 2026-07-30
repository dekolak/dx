import Link from "next/link";
import { notFound } from "next/navigation";
import { getPiece } from "@/lib/data";
import { PhotoAnnotator } from "@/components/PhotoAnnotator";
import type { EntryData } from "@/components/EntryCard";
import { PointsAccordion } from "@/components/PointsAccordion";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function PiecePage({ params }: { params: Promise<{ pieceId: string }> }) {
  const { pieceId } = await params;
  const piece = await getPiece(pieceId);
  if (!piece) notFound();

  const markers = piece.points.map((p) => ({ id: p.id, num: p.num, x: p.x, y: p.y }));

  return (
    <>
      <div className="topbar">
        <Link href={`/installations/${piece.installationId}`} className="back">
          ‹ {piece.installation.name}
        </Link>
      </div>
      <div className="topbar">
        <h1>{piece.name}</h1>
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
          point: { id: point.id, num: point.num, x: point.x, y: point.y },
          entries: point.entries as unknown as EntryData[],
        }))}
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
