import { listJournal, listJournalTargets } from "@/lib/data";
import { JournalComposer } from "@/components/JournalComposer";
import { JournalList } from "@/components/JournalList";
import type { JournalEntry } from "@/components/JournalNote";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const [entries, targets] = await Promise.all([listJournal(), listJournalTargets()]);

  return (
    <>
      <div className="topbar">
        <h1>Journal</h1>
      </div>

      <JournalComposer targets={targets} />

      <div className="section-title">
        <span>Notes</span>
        <span className="line" />
      </div>

      <JournalList entries={entries as unknown as JournalEntry[]} targets={targets} />
    </>
  );
}
