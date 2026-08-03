// Normalisation des liaisons d'un repère (deux sens aPoint↔bPoint) en une liste
// prête à afficher, en écartant les repères / pièces supprimés. Partagé entre la
// page pièce (UI) et le générateur PDF.

export type NormalizedLink = {
  linkId: string;
  label: string | null;
  pointId: string;
  num: number;
  icon: string | null;
  pieceId: string;
  pieceName: string;
};

type LinkedPointRef = {
  id: string;
  num: number;
  icon: string | null;
  deletedAt: Date | string | null;
  piece: { id: string; name: string; deletedAt: Date | string | null } | null;
} | null;

export type PointWithLinks = {
  linksA: { id: string; label: string | null; bPoint: LinkedPointRef }[];
  linksB: { id: string; label: string | null; aPoint: LinkedPointRef }[];
};

export function normalizePointLinks(p: PointWithLinks): NormalizedLink[] {
  const raw = [
    ...p.linksA.map((l) => ({ linkId: l.id, label: l.label, other: l.bPoint })),
    ...p.linksB.map((l) => ({ linkId: l.id, label: l.label, other: l.aPoint })),
  ];
  return raw
    .filter((r) => r.other && !r.other.deletedAt && r.other.piece && !r.other.piece.deletedAt)
    .map((r) => ({
      linkId: r.linkId,
      label: r.label,
      pointId: r.other!.id,
      num: r.other!.num,
      icon: r.other!.icon,
      pieceId: r.other!.piece!.id,
      pieceName: r.other!.piece!.name,
    }));
}
