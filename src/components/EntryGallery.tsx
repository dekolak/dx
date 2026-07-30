"use client";
import { useState } from "react";
import type { EntryData } from "@/components/EntryCard";
import { EntryDetailModal } from "@/components/EntryDetailModal";

function shortDate(d: string | Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function snippet(text: string, n = 60) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function cover(entry: EntryData) {
  return entry.media.find((m) => m.type === "photo") ?? entry.media.find((m) => m.type === "video") ?? null;
}

// Vue galerie : chaque entrée = une vignette cliquable (photo si dispo, sinon
// tuile texte). Un clic ouvre le détail complet dans une modale. Remplace la
// longue liste de texte quand il y a beaucoup d'entrées/photos.
export function EntryGallery({ entries }: { entries: EntryData[] }) {
  const [selected, setSelected] = useState<EntryData | null>(null);

  if (entries.length === 0) return <p className="hint">Aucune info pour ce point.</p>;

  return (
    <>
      <div className="gallery">
        {entries.map((entry) => {
          const c = cover(entry);
          const extra = entry.media.length > 1 ? entry.media.length : 0;
          return (
            <button key={entry.id} className="tile-thumb" onClick={() => setSelected(entry)}>
              {c ? (
                c.type === "video" ? (
                  <>
                    <video src={c.url} muted preload="metadata" playsInline />
                    <span className="thumb-badge play">▶</span>
                  </>
                ) : (
                  <img src={c.url} alt="" loading="lazy" />
                )
              ) : (
                <span className="thumb-text">📝 {snippet(entry.text, 48) || "(vide)"}</span>
              )}
              {c && entry.text && <span className="thumb-caption">{snippet(entry.text, 28)}</span>}
              <span className="thumb-date">{shortDate(entry.createdAt)}</span>
              {extra > 0 && <span className="thumb-badge count">▦ {extra}</span>}
            </button>
          );
        })}
      </div>
      {selected && <EntryDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
