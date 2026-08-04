import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstallation } from "@/lib/data";
import { AddPiece } from "@/components/AddPiece";
import { AddSoftware } from "@/components/AddSoftware";
import { DeleteButton } from "@/components/DeleteButton";
import { InstallationActiveToggle } from "@/components/InstallationActiveToggle";
import { InstallationEditForm } from "@/components/InstallationEditForm";
import { OverviewSection } from "@/components/OverviewSection";
import { LinkedJournalNotes } from "@/components/LinkedJournalNotes";
import type { EntryData } from "@/components/EntryCard";

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

      {/* Ordinateur : 2 colonnes — visuel (fiche + vue d'ensemble) à gauche,
          listes (pièces + software + notes) à droite. Mobile : empilé. */}
      <div className="inst-cols">
        <div className="inst-left">
          <div className="section-title">
            <span>Fiche</span>
            <span className="line" />
          </div>
          <InstallationEditForm installation={installation} />

          <div className="section-title">
            <span>Vue d’ensemble</span>
            <span className="line" />
          </div>
          <OverviewSection
            installationId={installation.id}
            pieces={installation.pieces.map((p) => ({ id: p.id, name: p.name }))}
            photos={installation.photosEnsemble.map((ph) => ({
              id: ph.id,
              url: ph.url,
              label: ph.label,
              points: ph.points.map((pt) => ({
                id: pt.id,
                num: pt.num,
                x: pt.x,
                y: pt.y,
                icon: pt.icon,
                targetPiece: pt.targetPiece,
                entries: pt.entries as unknown as EntryData[],
              })),
            }))}
          />
        </div>

        <div className="inst-right">
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

          <LinkedJournalNotes entries={installation.journalEntries as unknown as EntryData[]} />
        </div>
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
