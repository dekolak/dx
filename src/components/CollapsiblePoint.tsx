"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { EntryData } from "@/components/EntryCard";
import { EntryGallery } from "@/components/EntryGallery";
import { EntryComposer } from "@/components/EntryComposer";
import { DeleteButton } from "@/components/DeleteButton";

type PointData = { id: string; num: number; x: number | null; y: number | null; icon?: string | null };

// Jeu d'icônes prêtes à l'emploi (repères atelier / électronique).
export const POINT_ICONS = ["⚠️", "⚡", "🔌", "🔧", "🔩", "🔥", "💧", "🌡️", "🔋", "⚙️", "💡", "📷"];

function snippet(text: string, n = 42) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

// Un point repliable, CONTRÔLÉ par le parent (accordéon : un seul ouvert à la
// fois). Replié : vignette + n° + titre court + compteurs. Déplié : galerie +
// ajout d'info + suppression.
export function CollapsiblePoint({
  point,
  entries,
  open,
  onToggle,
}: {
  point: PointData;
  entries: EntryData[];
  open: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Quand il s'ouvre, on le fait remonter dans la vue (utile sur mobile).
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  async function setIcon(icon: string | null) {
    setBusy(true);
    try {
      await api.updatePoint(point.id, { icon });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const latest = entries[entries.length - 1];
  const photoCount = entries.reduce((n, e) => n + e.media.filter((m) => m.type === "photo").length, 0);
  const title = latest ? snippet(latest.text) || "(média)" : "Aucune info";
  const thumb = entries.flatMap((e) => e.media).find((m) => m.type === "photo");

  return (
    <section ref={ref} id={`point-${point.id}`} className="card point-card">
      <button className="point-header" onClick={onToggle} aria-expanded={open}>
        {thumb ? (
          <img className="point-thumb" src={thumb.url} alt="" loading="lazy" />
        ) : (
          <span className="point-num-badge">{point.num}</span>
        )}
        <span className="point-header-main">
          <span className="point-header-line1">
            {point.icon && <span className="point-icon-tag">{point.icon}</span>}
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
          <div className="icon-picker">
            <span className="icon-picker-label">Icône</span>
            {POINT_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={`icon-opt ${point.icon === ic ? "sel" : ""}`}
                disabled={busy}
                aria-pressed={point.icon === ic}
                onClick={() => setIcon(point.icon === ic ? null : ic)}
              >
                {ic}
              </button>
            ))}
            <button
              type="button"
              className={`icon-opt clear ${!point.icon ? "sel" : ""}`}
              disabled={busy}
              onClick={() => setIcon(null)}
              aria-label="Aucune icône"
            >
              ∅
            </button>
          </div>
          <EntryGallery entries={entries} />
          <div style={{ marginTop: 10 }}>
            <EntryComposer type="point" pointId={point.id} compact submitLabel="Ajouter une info" />
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <span style={{ flex: 1 }} />
            <DeleteButton
              kind="point"
              id={point.id}
              label="🗑️"
              confirmText="Supprimer ce point (et son historique) ?"
              className="btn ghost xs danger"
            />
          </div>
        </div>
      )}
    </section>
  );
}
