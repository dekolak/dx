import Link from "next/link";
import { listMachines, machineCounts } from "@/lib/data";
import { AddMachine } from "@/components/AddMachine";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const [machines, counts] = await Promise.all([listMachines(), machineCounts()]);

  return (
    <>
      <div className="topbar">
        <h1>Machines</h1>
        <LogoutButton />
      </div>

      <div className="grid">
        {machines.length === 0 && (
          <p className="empty">
            {counts.inactive > 0
              ? "Aucune machine active. Marquez-en une comme active, ou voyez toutes les machines."
              : "Aucune machine. Ajoutez-en une pour commencer."}
          </p>
        )}
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

      {counts.active + counts.inactive > 0 && (
        <div style={{ marginTop: 12 }}>
          <Link href="/machines" className="tile">
            <div style={{ fontWeight: 600 }}>Toutes les machines</div>
            <span className="sub" style={{ marginLeft: "auto" }}>
              {counts.inactive > 0
                ? `${counts.active + counts.inactive} dont ${counts.inactive} hors vue`
                : `${counts.active + counts.inactive} au total`}
            </span>
            <span className="chev">›</span>
          </Link>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <AddMachine />
      </div>
    </>
  );
}
