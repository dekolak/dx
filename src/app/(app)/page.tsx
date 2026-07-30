import Link from "next/link";
import { listMachines } from "@/lib/data";
import { AddMachine } from "@/components/AddMachine";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const machines = await listMachines();

  return (
    <>
      <div className="topbar">
        <h1>Machines</h1>
        <LogoutButton />
      </div>

      <div className="grid">
        {machines.length === 0 && <p className="empty">Aucune machine. Ajoutez-en une pour commencer.</p>}
        {machines.map((m) => (
          <Link key={m.id} href={`/machines/${m.id}`} className="tile">
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{m.name}</div>
              <div className="sub">
                {m.category ? `${m.category} · ` : ""}
                {m._count.pieces} pièce{m._count.pieces > 1 ? "s" : ""} · {m._count.softwareItems} software
              </div>
            </div>
            <span className="chev">›</span>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <AddMachine />
      </div>
    </>
  );
}
