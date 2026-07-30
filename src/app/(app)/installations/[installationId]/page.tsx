import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstallation } from "@/lib/data";
import { AddPiece } from "@/components/AddPiece";
import { AddSoftware } from "@/components/AddSoftware";
import { DeleteButton } from "@/components/DeleteButton";
import { InstallationActiveToggle } from "@/components/InstallationActiveToggle";
import { InstallationEditForm } from "@/components/InstallationEditForm";

export const dynamic = "force-dynamic";

export default async function InstallationPage({ params }: { params: Promise<{ installationId: string }> }) {
  const { installationId } = await params;
  const installation = await getInstallation(installationId);
  if (!installation) notFound();

  return (
    <>
      <div className="topbar">
        <Link href="/" className="back">
          ‹ Installations
        </Link>
      </div>
      <div className="topbar">
        <h1>{installation.name}</h1>
        <InstallationActiveToggle id={installation.id} active={installation.active} />
      </div>
      {installation.category && <div className="crumbs">{installation.category}</div>}

      <div className="section-title">
        <span>Fiche</span>
        <span className="line" />
      </div>
      <InstallationEditForm installation={installation} />

      <div className="section-title">
        <span>Pièces</span>
        <span className="line" />
      </div>
      <div className="grid">
        {installation.pieces.length === 0 && <p className="empty">Aucune pièce.</p>}
        {installation.pieces.map((p) => (
          <Link key={p.id} href={`/pieces/${p.id}`} className="tile">
            {p.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
            )}
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              {p.category && <div className="sub">{p.category}</div>}
            </div>
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <AddPiece installationId={installation.id} />
      </div>

      <div className="section-title">
        <span>Software</span>
        <span className="line" />
      </div>
      <div className="grid">
        {installation.softwareItems.length === 0 && <p className="empty">Aucun software.</p>}
        {installation.softwareItems.map((s) => (
          <Link key={s.id} href={`/software/${s.id}`} className="tile">
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <AddSoftware installationId={installation.id} />
      </div>

      <div className="danger-zone">
        <DeleteButton
          kind="installation"
          id={installation.id}
          label="🗑️ Supprimer l'installation"
          confirmText="Envoyer cette installation à la corbeille ?"
          redirectTo="/"
          className="btn ghost sm danger"
        />
      </div>
    </>
  );
}
