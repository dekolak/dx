import Link from "next/link";
import { listJournal, listPiecesForPicker } from "@/lib/data";
import { JournalComposer } from "@/components/JournalComposer";
import { EntryCard, type EntryData } from "@/components/EntryCard";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const [entries, pieces] = await Promise.all([listJournal(), listPiecesForPicker()]);

  return (
    <>
      <div className="topbar">
        <h1>Journal</h1>
      </div>

      <JournalComposer pieces={pieces} />

      <div className="section-title">
        <span>Notes</span>
        <span className="line" />
      </div>

      <div className="grid">
        {entries.length === 0 && <p className="empty">Aucune note pour l’instant.</p>}
        {entries.map((e) => (
          <div key={e.id}>
            {e.linkedPiece && (
              <div className="crumbs" style={{ marginBottom: 4 }}>
                🔗 Lié à{" "}
                <Link href={`/pieces/${e.linkedPiece.id}`} style={{ color: "var(--accent)" }}>
                  {e.linkedPiece.installation.name} — {e.linkedPiece.name}
                </Link>
              </div>
            )}
            <EntryCard entry={e as unknown as EntryData} />
          </div>
        ))}
      </div>
    </>
  );
}
