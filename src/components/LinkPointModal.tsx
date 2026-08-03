"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { LinkTargetPiece } from "@/components/CollapsiblePoint";

// Modale « Relier ce repère à un autre » : choisir une pièce de l'installation,
// puis un de ses repères, avec un libellé facultatif (ex. « nappe 20 broches »).
export function LinkPointModal({
  pointId,
  targets,
  alreadyLinked,
  onClose,
}: {
  pointId: string;
  targets: LinkTargetPiece[];
  alreadyLinked: Set<string>; // pointIds déjà reliés (+ soi-même) → masqués
  onClose: () => void;
}) {
  const router = useRouter();
  const [pieceId, setPieceId] = useState("");
  const [targetPointId, setTargetPointId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const piece = useMemo(() => targets.find((p) => p.pieceId === pieceId), [targets, pieceId]);
  const points = useMemo(
    () => (piece ? piece.points.filter((pt) => !alreadyLinked.has(pt.id)) : []),
    [piece, alreadyLinked],
  );

  async function submit() {
    if (!targetPointId) return;
    setBusy(true);
    setError(null);
    try {
      await api.createPointLink({ pointId, targetPointId, label: label.trim() || undefined });
      router.refresh();
      onClose();
    } catch {
      setError("Impossible de créer la liaison.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <p className="sub" style={{ margin: "0 0 12px" }}>🔗 Relier ce repère à un autre</p>

        <label>Pièce (carte) cible</label>
        <select
          value={pieceId}
          onChange={(e) => {
            setPieceId(e.target.value);
            setTargetPointId("");
          }}
        >
          <option value="">— Choisir une pièce —</option>
          {targets.map((p) => (
            <option key={p.pieceId} value={p.pieceId}>
              {p.pieceName}
            </option>
          ))}
        </select>

        {piece && (
          <>
            <label style={{ marginTop: 10 }}>Repère</label>
            {points.length === 0 ? (
              <p className="hint">Aucun repère disponible sur cette pièce.</p>
            ) : (
              <select value={targetPointId} onChange={(e) => setTargetPointId(e.target.value)}>
                <option value="">— Choisir un repère —</option>
                {points.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.icon ? `${pt.icon} ` : ""}Point {pt.num}
                    {pt.title ? ` — ${pt.title}` : ""}
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        <label style={{ marginTop: 10 }}>Libellé (facultatif)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex : nappe 20 broches, 24V"
          maxLength={120}
        />

        {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}

        <div className="btn-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn ghost sm" disabled={busy} onClick={onClose}>
            Annuler
          </button>
          <button className="btn primary sm" disabled={busy || !targetPointId} onClick={submit}>
            Relier
          </button>
        </div>
      </div>
    </div>
  );
}
