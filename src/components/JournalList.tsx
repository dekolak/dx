"use client";
import { useMemo, useState } from "react";
import { JournalNote, describeLink, type JournalEntry } from "@/components/JournalNote";
import type { JournalTargets } from "@/components/JournalComposer";

type Filter = "all" | "photo" | "linked" | "unlinked";

function hasPhoto(e: JournalEntry) {
  return e.media.some((m) => m.type === "photo");
}

// Liste du journal avec recherche plein-texte (note + cible liée) et filtres.
export function JournalList({ entries, targets }: { entries: JournalEntry[]; targets: JournalTargets }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const link = describeLink(e);
      if (filter === "photo" && !hasPhoto(e)) return false;
      if (filter === "linked" && !link) return false;
      if (filter === "unlinked" && link) return false;
      if (q) {
        const hay = `${e.text} ${link?.label ?? ""} ${link?.kind ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, query, filter]);

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "photo", label: "📷 Avec photo" },
    { key: "linked", label: "🔗 Liées" },
    { key: "unlinked", label: "Non liées" },
  ];

  return (
    <div>
      <div className="journal-filters">
        <input
          className="journal-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans les notes…"
          type="search"
          aria-label="Rechercher"
        />
        <div className="filter-chips">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip-btn ${filter === c.key ? "sel" : ""}`}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {entries.length === 0 && <p className="empty">Aucune note pour l’instant.</p>}
        {entries.length > 0 && shown.length === 0 && <p className="empty">Aucune note ne correspond.</p>}
        {shown.map((e) => (
          <JournalNote key={e.id} entry={e} targets={targets} />
        ))}
      </div>
    </div>
  );
}
