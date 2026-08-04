"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadFile } from "@/lib/client";
import { ZoomablePhoto, type PhotoMarker } from "@/components/ZoomablePhoto";

type OverviewPoint = {
  id: string;
  num: number;
  x: number | null;
  y: number | null;
  icon?: string | null;
  title?: string;
  meta?: string;
  thumb?: string | null;
  targetPiece: { id: string; name: string; deletedAt: string | Date | null } | null;
};

// Photo d'ensemble annotée : réutilise ZoomablePhoto. Au placement d'un point,
// propose « Raccourci vers une pièce » ou « Info libre ».
export function OverviewAnnotator({
  photoEnsembleId,
  photoUrl,
  label,
  points,
  pieces,
}: {
  photoEnsembleId: string;
  photoUrl: string;
  label: string | null;
  points: OverviewPoint[];
  pieces: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);

  async function movePoint(id: string, x: number, y: number, w?: number, h?: number) {
    await api.updatePoint(id, w != null && h != null ? { x, y, w, h } : { x, y });
    router.refresh();
  }

  async function changePhoto(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    try {
      const media = await uploadFile(files[0]);
      await api.updatePhotoEnsemble(photoEnsembleId, { url: media.url });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [choicePiece, setChoicePiece] = useState("");
  // « Armé » : évite que le tap qui OUVRE le chooser (sous le doigt) ne clique
  // aussitôt un bouton du chooser via son click synthétique.
  const [armed, setArmed] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(label ?? "");

  async function saveLabel() {
    setBusy(true);
    try {
      await api.updatePhotoEnsemble(photoEnsembleId, { label: labelValue });
      setEditingLabel(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function markerFor(p: OverviewPoint): PhotoMarker {
    if (p.targetPiece) {
      const gone = !!p.targetPiece.deletedAt;
      return {
        id: p.id,
        num: p.num,
        x: p.x,
        y: p.y,
        icon: p.icon,
        href: gone ? "#" : `/pieces/${p.targetPiece.id}`,
        className: "shortcut",
        title: `→ ${p.targetPiece.name}`,
        meta: gone ? "Pièce supprimée" : "Raccourci vers une pièce",
        actionLabel: gone ? undefined : "Ouvrir la pièce ›",
      };
    }
    return { id: p.id, num: p.num, x: p.x, y: p.y, icon: p.icon, href: `#point-${p.id}`, title: p.title, meta: p.meta, thumb: p.thumb };
  }

  function onPlace(x: number, y: number) {
    setPlacing(false);
    setChoicePiece("");
    setArmed(false);
    setPending({ x, y }); // ouvre le chooser
    setTimeout(() => setArmed(true), 350); // arme les boutons après le tap
  }

  async function createPoint(targetPieceId?: string) {
    if (!pending) return;
    setBusy(true);
    try {
      const pt = await api.createPoint({ photoEnsembleId, x: pending.x, y: pending.y, targetPieceId });
      setPending(null);
      router.refresh();
      // Point info : on ouvre son accordéon ; raccourci : rien (la pastille suffit).
      if (!targetPieceId) window.location.hash = `point-${(pt as { id: string }).id}`;
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto() {
    if (!confirm("Envoyer cette photo d’ensemble à la corbeille (avec ses points) ?")) return;
    setBusy(true);
    try {
      await api.deletePhotoEnsemble(photoEnsembleId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {editingLabel ? (
          <>
            <input
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              placeholder="ex : Vue de face"
              autoFocus
              style={{ flex: 1 }}
            />
            <button className="btn primary xs" disabled={busy} onClick={saveLabel}>
              OK
            </button>
            <button className="btn ghost xs" disabled={busy} onClick={() => setEditingLabel(false)}>
              ✕
            </button>
          </>
        ) : (
          <>
            <button
              className="reorder-label overview-photo-label"
              style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
              onClick={() => {
                setLabelValue(label ?? "");
                setEditingLabel(true);
              }}
            >
              {label || "Photo d’ensemble"} <span style={{ color: "var(--muted)" }}>✎</span>
            </button>
            <button className="btn ghost xs danger" disabled={busy} onClick={deletePhoto}>
              🗑️
            </button>
          </>
        )}
      </div>

      <ZoomablePhoto
        photoUrl={photoUrl}
        markers={points.map(markerFor)}
        placing={placing}
        onPlace={onPlace}
        moving={moving}
        onMove={movePoint}
        alt="Photo d’ensemble"
      />

      <p className="hint">
        {placing
          ? "Touchez la photo à l’endroit du point (zoomez d’abord pour plus de précision)."
          : moving
            ? "Glissez une pastille pour la repositionner."
            : "Pincez pour zoomer · double-tap pour (dé)zoomer. Pastille verte = raccourci vers une pièce."}
      </p>
      <div className="btn-row" style={{ marginTop: 6 }}>
        <button className={`btn sm ${placing ? "primary" : ""}`} disabled={busy || moving} onClick={() => setPlacing((v) => !v)}>
          {placing ? "① Touchez la photo…" : "＋ Placer un point"}
        </button>
        <button className={`btn sm ${moving ? "primary" : ""}`} disabled={busy || placing} onClick={() => setMoving((v) => !v)}>
          {moving ? "✓ Terminer" : "⇄ Déplacer"}
        </button>
        <label className="btn sm ghost" style={{ marginLeft: "auto" }}>
          Changer la photo
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => changePhoto(e.target.files)} />
        </label>
      </div>

      {pending && (
        // Pas de fermeture au tap sur le fond : le tap qui ouvre le chooser
        // pourrait sinon le refermer aussitôt (fermeture via « Annuler »).
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 420, paddingTop: 16 }}>
            <p className="sub" style={{ margin: "0 0 10px" }}>Nouveau point — que représente-t-il ?</p>

            {pieces.length > 0 ? (
              <>
                <label>Raccourci vers une pièce</label>
                <select value={choicePiece} onChange={(e) => setChoicePiece(e.target.value)}>
                  <option value="">— Choisir une pièce —</option>
                  {pieces.map((pc) => (
                    <option key={pc.id} value={pc.id}>{pc.name}</option>
                  ))}
                </select>
                <button
                  className="btn primary"
                  style={{ width: "100%", marginTop: 8 }}
                  disabled={busy || !armed || !choicePiece}
                  onClick={() => createPoint(choicePiece)}
                >
                  → Raccourci vers cette pièce
                </button>
              </>
            ) : (
              <p className="hint">Aucune pièce à lier (ajoutez-en dans l’installation).</p>
            )}

            <div className="section-title" style={{ margin: "16px 0 8px" }}>
              <span>ou</span>
              <span className="line" />
            </div>
            <button className="btn" style={{ width: "100%" }} disabled={busy || !armed} onClick={() => createPoint(undefined)}>
              📝 Point d’info libre
            </button>

            <div className="btn-row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn ghost sm" disabled={busy} onClick={() => setPending(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
