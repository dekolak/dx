import Link from "next/link";
import { notFound } from "next/navigation";
import { getSoftwareItem } from "@/lib/data";
import { EntryCard, type EntryData } from "@/components/EntryCard";
import { EntryComposer } from "@/components/EntryComposer";
import { SoftwareDescription } from "@/components/SoftwareDescription";
import { SoftwareVersions, type SoftwareVersionData } from "@/components/SoftwareVersions";
import { LinkedJournalNotes } from "@/components/LinkedJournalNotes";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function SoftwarePage({ params }: { params: Promise<{ softwareItemId: string }> }) {
  const { softwareItemId } = await params;
  const item = await getSoftwareItem(softwareItemId);
  if (!item) notFound();

  return (
    <>
      <div className="topbar">
        <Link href={`/installations/${item.installationId}`} className="back">
          ‹ {item.installation.name}
        </Link>
      </div>
      <div className="topbar">
        <h1>{item.name}</h1>
      </div>
      <div className="crumbs">Logiciel · versions &amp; notes</div>

      <div className="section-title">
        <span>Description</span>
        <span className="line" />
      </div>
      <SoftwareDescription softwareItemId={item.id} description={item.description} />

      <div className="section-title">
        <span>Versions ({item.versions.length})</span>
        <span className="line" />
      </div>
      <SoftwareVersions softwareItemId={item.id} versions={item.versions as unknown as SoftwareVersionData[]} />

      <div className="section-title">
        <span>Notes / changelog</span>
        <span className="line" />
      </div>

      <EntryComposer type="software" softwareItemId={item.id} submitLabel="Ajouter une note" />

      <div className="grid">
        {item.entries.length === 0 && <p className="empty">Aucune note.</p>}
        {item.entries.map((e) => (
          <EntryCard key={e.id} entry={e as unknown as EntryData} />
        ))}
      </div>

      <LinkedJournalNotes entries={item.journalEntries as unknown as EntryData[]} />

      <div className="section-title">
        <span>Zone de danger</span>
        <span className="line" />
      </div>
      <DeleteButton
        kind="software"
        id={item.id}
        label="🗑️ Supprimer ce software"
        confirmText="Envoyer à la corbeille ?"
        redirectTo={`/installations/${item.installationId}`}
        className="btn danger"
      />
    </>
  );
}
