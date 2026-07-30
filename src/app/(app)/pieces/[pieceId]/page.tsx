import Link from "next/link";
import { notFound } from "next/navigation";
import { getPiece } from "@/lib/data";
import { PhotoAnnotator } from "@/components/PhotoAnnotator";
import { EntryCard, type EntryData } from "@/components/EntryCard";
import { EntryComposer } from "@/components/EntryComposer";
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
        <Link href={`/machines/${piece.machineId}`} className="back">
          ‹ {piece.machine.name}
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

      <div className="grid">
        {piece.points.map((point) => (
          <section key={point.id} id={`point-${point.id}`} className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="pill" style={{ background: "var(--accent)", color: "#fff" }}>
                Point {point.num}
              </span>
              {point.x == null && <span className="pill">libre / virtuel</span>}
              <span style={{ flex: 1 }} />
              <DeleteButton kind="point" id={point.id} label="🗑️" confirmText="Supprimer ce point (et son historique) ?" />
            </div>

            <div className="grid" style={{ gap: 8 }}>
              {point.entries.length === 0 && <p className="hint">Aucune info pour ce point.</p>}
              {point.entries.map((e) => (
                <EntryCard key={e.id} entry={e as unknown as EntryData} />
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <EntryComposer type="point" pointId={point.id} compact submitLabel="Ajouter une info" />
            </div>
          </section>
        ))}
      </div>

      <div className="section-title">
        <span>Zone de danger</span>
        <span className="line" />
      </div>
      <DeleteButton
        kind="piece"
        id={piece.id}
        label="🗑️ Supprimer la pièce"
        confirmText="Envoyer cette pièce à la corbeille ?"
        redirectTo={`/machines/${piece.machineId}`}
        className="btn danger"
      />
    </>
  );
}
