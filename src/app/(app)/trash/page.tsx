import { listTrash } from "@/lib/data";
import { TrashItem } from "@/components/TrashItem";

export const dynamic = "force-dynamic";

function excerpt(text: string) {
  return text.length > 80 ? `${text.slice(0, 80)}…` : text || "(sans texte)";
}

export default async function TrashPage() {
  const { installations, pieces, points, softwareItems, photosEnsemble, entries } = await listTrash();
  const total =
    installations.length + pieces.length + points.length + softwareItems.length + photosEnsemble.length + entries.length;

  return (
    <>
      <div className="topbar">
        <h1>Corbeille</h1>
      </div>
      <p className="hint">
        Éléments supprimés (soft delete). Restaurez-les, ou purgez définitivement (irréversible, supprime aussi les
        fichiers média sur le disque).
      </p>

      {total === 0 && <p className="empty">La corbeille est vide.</p>}

      <div className="grid">
        {installations.map((m) => (
          <TrashItem key={m.id} kind="installation" id={m.id} title={m.name} subtitle={m.category ?? undefined} />
        ))}
        {pieces.map((p) => (
          <TrashItem key={p.id} kind="piece" id={p.id} title={p.name} subtitle={`Installation : ${p.installation.name}`} />
        ))}
        {points.map((p) => (
          <TrashItem
            key={p.id}
            kind="point"
            id={p.id}
            title={`Point ${p.num}`}
            subtitle={p.piece ? `Pièce : ${p.piece.name}` : "Photo d’ensemble"}
          />
        ))}
        {photosEnsemble.map((ph) => (
          <TrashItem
            key={ph.id}
            kind="photoEnsemble"
            id={ph.id}
            title={ph.label || "Photo d’ensemble"}
            subtitle={`Installation : ${ph.installation.name}`}
          />
        ))}
        {softwareItems.map((s) => (
          <TrashItem key={s.id} kind="software" id={s.id} title={s.name} subtitle={`Installation : ${s.installation.name}`} />
        ))}
        {entries.map((e) => (
          <TrashItem key={e.id} kind="entry" id={e.id} title={excerpt(e.text)} subtitle={`Entrée ${e.type}`} />
        ))}
      </div>
    </>
  );
}
