import Link from "next/link";
import { listInstallations } from "@/lib/data";
import { InstallationActiveToggle } from "@/components/InstallationActiveToggle";

export const dynamic = "force-dynamic";

export default async function AllInstallationsPage() {
  const installations = await listInstallations({ includeInactive: true });

  return (
    <>
      <div className="topbar">
        <Link href="/" className="back">
          ‹ Actives
        </Link>
      </div>
      <div className="topbar">
        <h1>Toutes les installations</h1>
      </div>
      <p className="hint">
        Marquez comme « active » les installations utilisées au quotidien : seules celles-ci apparaissent dans la vue
        principale.
      </p>

      <div className="grid">
        {installations.length === 0 && <p className="empty">Aucune installation.</p>}
        {installations.map((m) => (
          <Link key={m.id} href={`/installations/${m.id}`} className={`tile ${m.active ? "" : "tile-muted"}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{m.name}</div>
              <div className="sub">
                {m.category ? `${m.category} · ` : ""}
                {m._count.pieces} pièce{m._count.pieces > 1 ? "s" : ""} · {m._count.softwareItems} software
              </div>
            </div>
            <InstallationActiveToggle id={m.id} active={m.active} />
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
    </>
  );
}
