import Link from "next/link";
import { notFound } from "next/navigation";
import { getSoftwareItem } from "@/lib/data";
import { EntryCard, type EntryData } from "@/components/EntryCard";
import { EntryComposer } from "@/components/EntryComposer";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function SoftwarePage({ params }: { params: Promise<{ softwareItemId: string }> }) {
  const { softwareItemId } = await params;
  const item = await getSoftwareItem(softwareItemId);
  if (!item) notFound();

  return (
    <>
      <div className="topbar">
        <Link href={`/machines/${item.machineId}`} className="back">
          ‹ {item.machine.name}
        </Link>
      </div>
      <div className="topbar">
        <h1>{item.name}</h1>
      </div>
      <div className="crumbs">Changelog / historique de versions</div>

      <EntryComposer type="software" softwareItemId={item.id} submitLabel="Ajouter une version / note" />

      <div className="section-title">
        <span>Historique</span>
        <span className="line" />
      </div>

      <div className="grid">
        {item.entries.length === 0 && <p className="empty">Aucune entrée. Ajoutez la première version.</p>}
        {item.entries.map((e) => (
          <EntryCard key={e.id} entry={e as unknown as EntryData} />
        ))}
      </div>

      <div className="section-title">
        <span>Zone de danger</span>
        <span className="line" />
      </div>
      <DeleteButton
        kind="software"
        id={item.id}
        label="🗑️ Supprimer ce software"
        confirmText="Envoyer à la corbeille ?"
        redirectTo={`/machines/${item.machineId}`}
        className="btn danger"
      />
    </>
  );
}
