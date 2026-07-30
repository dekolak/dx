"use client";
import { useEffect, useRef, useState } from "react";
import type { EntryData } from "@/components/EntryCard";
import { EntryGallery } from "@/components/EntryGallery";
import { EntryComposer } from "@/components/EntryComposer";
import { DeleteButton } from "@/components/DeleteButton";

type PointData = { id: string; num: number; x: number | null; y: number | null };

function snippet(text: string, n = 42) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

// Un point repliable : replié par défaut (numéro + titre court + compteurs),
// déplié au clic pour voir/éditer son contenu (galerie + ajout d'info + suppr).
// S'ouvre automatiquement si l'ancre #point-<id> est ciblée (clic sur un marqueur
// de la photo, ou point tout juste créé).
export function CollapsiblePoint({ point, entries }: { point: PointData; entries: EntryData[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const anchor = `#point-${point.id}`;
    const sync = () => {
      if (window.location.hash === anchor) {
        setOpen(true);
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [point.id]);

  const latest = entries[entries.length - 1];
  const photoCount = entries.reduce((n, e) => n + e.media.filter((m) => m.type === "photo").length, 0);
  const title = latest ? snippet(latest.text) || "(média)" : "Aucune info";
  const thumb = entries
    .flatMap((e) => e.media)
    .find((m) => m.type === "photo");

  return (
    <section ref={ref} id={`point-${point.id}`} className="card point-card">
      <button className="point-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {thumb ? (
          <img className="point-thumb" src={thumb.url} alt="" loading="lazy" />
        ) : (
          <span className="point-num-badge">{point.num}</span>
        )}
        <span className="point-header-main">
          <span className="point-header-line1">
            <span className="pill point-pill">Point {point.num}</span>
            {point.x == null && <span className="pill">libre</span>}
          </span>
          <span className="point-title">{title}</span>
          <span className="point-meta">
            {entries.length} info{entries.length > 1 ? "s" : ""}
            {photoCount > 0 ? ` · ${photoCount} 📷` : ""}
          </span>
        </span>
        <span className={`point-chevron ${open ? "open" : ""}`}>▸</span>
      </button>

      {open && (
        <div className="point-body">
          <EntryGallery entries={entries} />
          <div style={{ marginTop: 10 }}>
            <EntryComposer type="point" pointId={point.id} compact submitLabel="Ajouter une info" />
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <span style={{ flex: 1 }} />
            <DeleteButton
              kind="point"
              id={point.id}
              label="🗑️ Supprimer le point"
              confirmText="Supprimer ce point (et son historique) ?"
            />
          </div>
        </div>
      )}
    </section>
  );
}
