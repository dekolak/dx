import Link from "next/link";
import type { EntryData } from "@/components/EntryCard";
import { OverviewAnnotator } from "@/components/OverviewAnnotator";
import { PointsAccordion } from "@/components/PointsAccordion";
import { AddPhotoEnsemble } from "@/components/AddPhotoEnsemble";

type TargetPiece = { id: string; name: string; deletedAt: string | Date | null } | null;
type OverviewPoint = { id: string; num: number; x: number | null; y: number | null; targetPiece: TargetPiece; entries: EntryData[] };
type Photo = { id: string; url: string; label: string | null; points: OverviewPoint[] };

// Section « Vue d'ensemble » d'une installation : une ou plusieurs photos
// d'ensemble, chacune avec ses points (raccourci vers une pièce OU info libre).
export function OverviewSection({
  installationId,
  pieces,
  photos,
}: {
  installationId: string;
  pieces: { id: string; name: string }[];
  photos: Photo[];
}) {
  return (
    <div className="grid" style={{ gap: 18 }}>
      {photos.map((photo) => {
        const shortcuts = photo.points.filter((p) => p.targetPiece);
        const infos = photo.points.filter((p) => !p.targetPiece);
        return (
          <div key={photo.id} className="grid" style={{ gap: 10 }}>
            <OverviewAnnotator
              photoEnsembleId={photo.id}
              photoUrl={photo.url}
              label={photo.label}
              points={photo.points.map((p) => ({ id: p.id, num: p.num, x: p.x, y: p.y, targetPiece: p.targetPiece }))}
              pieces={pieces}
            />

            {shortcuts.length > 0 && (
              <div className="grid" style={{ gap: 6 }}>
                {shortcuts.map((p) =>
                  p.targetPiece && !p.targetPiece.deletedAt ? (
                    <Link key={p.id} href={`/pieces/${p.targetPiece.id}`} className="tile">
                      <span className="pill point-pill">{p.num}</span>
                      <span style={{ fontWeight: 600 }}>→ {p.targetPiece.name}</span>
                      <span className="chev">›</span>
                    </Link>
                  ) : (
                    <div key={p.id} className="tile tile-muted">
                      <span className="pill point-pill">{p.num}</span>
                      <span className="sub">→ pièce supprimée</span>
                    </div>
                  ),
                )}
              </div>
            )}

            {infos.length > 0 && (
              <PointsAccordion items={infos.map((p) => ({ point: { id: p.id, num: p.num, x: p.x, y: p.y }, entries: p.entries }))} />
            )}
          </div>
        );
      })}

      <AddPhotoEnsemble installationId={installationId} />
    </div>
  );
}
