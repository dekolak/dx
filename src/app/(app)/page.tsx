import Link from "next/link";
import { listInstallations, installationCounts } from "@/lib/data";
import { AddInstallation } from "@/components/AddInstallation";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function InstallationsPage() {
  const [installations, counts] = await Promise.all([listInstallations(), installationCounts()]);

  return (
    <>
      <div className="topbar">
        <h1>Installations</h1>
        <LogoutButton />
      </div>

      <div className="grid">
        {installations.length === 0 && (
          <p className="empty">
            {counts.inactive > 0
              ? "Aucune installation active. Marquez-en une comme active, ou voyez toutes les installations."
              : "Aucune installation. Ajoutez-en une pour commencer."}
          </p>
        )}
        {installations.map((m) => (
          <Link key={m.id} href={`/installations/${m.id}`} className="tile">
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
          <Link href="/installations" className="tile">
            <div style={{ fontWeight: 600 }}>Toutes les installations</div>
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
        <AddInstallation />
      </div>
    </>
  );
}
