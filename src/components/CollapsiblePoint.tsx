"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { EntryData } from "@/components/EntryCard";
import { EntryGallery } from "@/components/EntryGallery";
import { EntryComposer } from "@/components/EntryComposer";
import { DeleteButton } from "@/components/DeleteButton";
import { LinkPointModal } from "@/components/LinkPointModal";

type PointData = {
  id: string;
  num: number;
  x: number | null;
  y: number | null;
  w?: number | null;
  h?: number | null;
  color?: string | null;
  icon?: string | null;
};

// Couleurs prêtes pour une zone.
export const ZONE_COLORS = ["#4f8cff", "#ff5c5c", "#46d19e", "#ffb020", "#c46bff", "#ff7ab8", "#26c6da", "#9aa2b1"];

// Une liaison affichée : l'autre repère (pièce · n° · icône) + libellé.
export type LinkChip = {
  linkId: string;
  label: string | null;
  pointId: string;
  num: number;
  icon: string | null;
  pieceId: string;
  pieceName: string;
};
// Cibles possibles d'une liaison (repères de pièce de l'installation).
export type LinkTargetPiece = {
  pieceId: string;
  pieceName: string;
  points: { id: string; num: number; icon: string | null; title: string }[];
};

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
  links = [],
  linkTargets,
  open,
  onToggle,
}: {
  point: PointData;
  entries: EntryData[];
  links?: LinkChip[];
  linkTargets?: LinkTargetPiece[]; // fourni = liaison de repères activée (page pièce)
  open: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [linking, setLinking] = useState(false);
  const [editing, setEditing] = useState(false); // panneau « Personnaliser »

  async function removeLink(linkId: string) {
    setBusy(true);
    try {
      await api.deletePointLink(linkId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

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

  async function setColor(color: string) {
    setBusy(true);
    try {
      await api.updatePoint(point.id, { color });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const isZone = point.w != null && point.h != null;

  // Applique l'emoji tapé au clavier (le serveur ne garde que le 1er graphème).
  async function applyCustom() {
    const v = custom.trim();
    if (!v) return;
    setCustom("");
    await setIcon(v);
  }

  const customIcon = point.icon && !POINT_ICONS.includes(point.icon) ? point.icon : null;

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
            <span className="pill point-pill">{isZone ? "Zone" : "Point"} {point.num}</span>
            {point.x == null && <span className="pill">libre</span>}
            {links.length > 0 && <span className="pill link-pill" title="Liaisons">🔗 {links.length}</span>}
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
          {/* Infos d'abord : historique + ajout. */}
          <EntryGallery entries={entries} />
          <div style={{ marginTop: 10 }}>
            <EntryComposer type="point" pointId={point.id} compact submitLabel="Ajouter une info" />
          </div>

          {/* Personnalisation repliée derrière un bouton (icône, couleur, liaisons, suppression). */}
          <div className="point-tools">
            <button
              type="button"
              className={`btn ghost xs ${editing ? "primary" : ""}`}
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "✓ Terminer" : "⚙️ Personnaliser"}
            </button>
          </div>

          {editing && (
          <div className="point-edit">
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
            {/* Icône perso en cours (tapée au clavier, hors set) → toujours visible. */}
            {customIcon && (
              <button
                type="button"
                className="icon-opt sel"
                disabled={busy}
                aria-pressed
                title="Icône actuelle — cliquer pour retirer"
                onClick={() => setIcon(null)}
              >
                {customIcon}
              </button>
            )}
            <button
              type="button"
              className={`icon-opt clear ${!point.icon ? "sel" : ""}`}
              disabled={busy}
              onClick={() => setIcon(null)}
              aria-label="Aucune icône"
            >
              ∅
            </button>
            {/* Saisie clavier : n'importe quel emoji via le clavier du téléphone. */}
            <span className="icon-input-group">
              <input
                className="icon-input"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                  }
                }}
                placeholder="⌨️😀"
                aria-label="Saisir une icône au clavier"
                maxLength={8}
                disabled={busy}
              />
              <button type="button" className="btn xs" disabled={busy || !custom.trim()} onClick={applyCustom}>
                OK
              </button>
            </span>
          </div>

          {isZone && (
            <div className="icon-picker">
              <span className="icon-picker-label">Couleur</span>
              {ZONE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-opt ${(point.color ?? ZONE_COLORS[0]) === c ? "sel" : ""}`}
                  style={{ background: c }}
                  disabled={busy}
                  aria-label={`Couleur ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                className="color-input"
                value={point.color ?? ZONE_COLORS[0]}
                disabled={busy}
                aria-label="Couleur personnalisée"
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          )}

          {(links.length > 0 || linkTargets) && (
            <div className="link-block">
              <span className="link-block-label">🔗 Liaisons</span>
              <div className="link-chips">
                {links.map((l) => (
                  <span key={l.linkId} className="link-chip">
                    <Link href={`/pieces/${l.pieceId}#point-${l.pointId}`} className="link-chip-go">
                      {l.icon ? `${l.icon} ` : ""}
                      {l.pieceName} · Point {l.num}
                      {l.label ? ` — ${l.label}` : ""}
                    </Link>
                    <button
                      type="button"
                      className="link-chip-x"
                      disabled={busy}
                      aria-label="Retirer la liaison"
                      onClick={() => removeLink(l.linkId)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {linkTargets && (
                  <button type="button" className="btn xs" disabled={busy} onClick={() => setLinking(true)}>
                    ＋ Relier à un repère
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 10 }}>
            <span style={{ flex: 1 }} />
            <DeleteButton
              kind="point"
              id={point.id}
              label="🗑️ Supprimer"
              confirmText="Supprimer ce point (et son historique) ?"
              className="btn ghost xs danger"
            />
          </div>
          </div>
          )}
        </div>
      )}

      {linking && linkTargets && (
        <LinkPointModal
          pointId={point.id}
          targets={linkTargets}
          alreadyLinked={new Set<string>([point.id, ...links.map((l) => l.pointId)])}
          onClose={() => setLinking(false)}
        />
      )}
    </section>
  );
}
