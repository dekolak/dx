import { listTrash } from "@/lib/data";
import { TrashItem } from "@/components/TrashItem";

export const dynamic = "force-dynamic";

function excerpt(text: string) {
  return text.length > 80 ? `${text.slice(0, 80)}…` : text || "(sans texte)";
}

export default async function TrashPage() {
  const { machines, pieces, points, softwareItems, entries } = await listTrash();
  const total = machines.length + pieces.length + points.length + softwareItems.length + entries.length;

  return (
    <>
      <div className="topbar">
        <h1>Corbeille</h1>
      </div>
      <p className="hint">
        Éléments supprimés (soft delete). Restaurez-les, ou purgez définitivement (irréversible, supprime aussi les
        médias sur OVH).
      </p>

      {total === 0 && <p className="empty">La corbeille est vide.</p>}

      <div className="grid">
        {machines.map((m) => (
          <TrashItem key={m.id} kind="machine" id={m.id} title={m.name} subtitle={m.category ?? undefined} />
        ))}
        {pieces.map((p) => (
          <TrashItem key={p.id} kind="piece" id={p.id} title={p.name} subtitle={`Machine : ${p.machine.name}`} />
        ))}
        {points.map((p) => (
          <TrashItem key={p.id} kind="point" id={p.id} title={`Point ${p.num}`} subtitle={`Pièce : ${p.piece.name}`} />
        ))}
        {softwareItems.map((s) => (
          <TrashItem key={s.id} kind="software" id={s.id} title={s.name} subtitle={`Machine : ${s.machine.name}`} />
        ))}
        {entries.map((e) => (
          <TrashItem key={e.id} kind="entry" id={e.id} title={excerpt(e.text)} subtitle={`Entrée ${e.type}`} />
        ))}
      </div>
    </>
  );
}
