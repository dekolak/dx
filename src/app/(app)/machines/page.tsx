import Link from "next/link";
import { listMachines } from "@/lib/data";
import { MachineActiveToggle } from "@/components/MachineActiveToggle";

export const dynamic = "force-dynamic";

export default async function AllMachinesPage() {
  const machines = await listMachines({ includeInactive: true });

  return (
    <>
      <div className="topbar">
        <Link href="/" className="back">
          ‹ Actives
        </Link>
      </div>
      <div className="topbar">
        <h1>Toutes les machines</h1>
      </div>
      <p className="hint">
        Marquez comme « active » les machines utilisées au quotidien : seules celles-ci apparaissent dans la vue
        principale.
      </p>

      <div className="grid">
        {machines.length === 0 && <p className="empty">Aucune machine.</p>}
        {machines.map((m) => (
          <Link key={m.id} href={`/machines/${m.id}`} className={`tile ${m.active ? "" : "tile-muted"}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{m.name}</div>
              <div className="sub">
                {m.category ? `${m.category} · ` : ""}
                {m._count.pieces} pièce{m._count.pieces > 1 ? "s" : ""} · {m._count.softwareItems} software
              </div>
            </div>
            <MachineActiveToggle id={m.id} active={m.active} />
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
    </>
  );
}
