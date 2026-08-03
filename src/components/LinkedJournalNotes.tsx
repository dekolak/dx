import { EntryCard, type EntryData } from "@/components/EntryCard";

// Section « Notes du journal » liées à une pièce / installation / logiciel.
// Rendue sur les fiches (lien journal → cible visible dans les deux sens).
export function LinkedJournalNotes({ entries }: { entries: EntryData[] }) {
  if (!entries || entries.length === 0) return null;
  return (
    <>
      <div className="section-title">
        <span>Notes du journal ({entries.length})</span>
        <span className="line" />
      </div>
      <div className="grid">
        {entries.map((e) => (
          <EntryCard key={e.id} entry={e} />
        ))}
      </div>
    </>
  );
}
