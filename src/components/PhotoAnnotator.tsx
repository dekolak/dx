"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadFile } from "@/lib/client";

type PointMarker = { id: string; num: number; x: number | null; y: number | null };

// Photo annotée d'une pièce : place des points numérotés (coordonnées relatives
// 0..1). Un point peut aussi être « libre / virtuel » (sans x/y), utile pour un
// point créé uniquement pour être partagé au client.
export function PhotoAnnotator({
  pieceId,
  photoUrl,
  points,
}: {
  pieceId: string;
  photoUrl: string | null;
  points: PointMarker[];
}) {
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setPhoto(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    try {
      const media = await uploadFile(files[0]);
      await api.updatePiece(pieceId, { photoUrl: media.url });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function placeAt(e: React.MouseEvent<HTMLDivElement>) {
    if (!placing || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setBusy(true);
    try {
      const pt = await api.createPoint({ pieceId, x, y });
      setPlacing(false);
      openNewPoint((pt as { id: string }).id);
    } finally {
      setBusy(false);
    }
  }

  async function addFreePoint() {
    setBusy(true);
    try {
      const pt = await api.createPoint({ pieceId });
      openNewPoint((pt as { id: string }).id);
    } finally {
      setBusy(false);
    }
  }

  // Cible l'ancre du nouveau point : le composant CollapsiblePoint écoute le
  // hash et se déplie + scrolle automatiquement dessus.
  function openNewPoint(id: string) {
    router.refresh();
    window.location.hash = `point-${id}`;
  }

  const placed = points.filter((p) => p.x != null && p.y != null);

  return (
    <div>
      {photoUrl ? (
        <div
          className={`annotator ${placing ? "placing" : ""}`}
          onClick={placeAt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Pièce" />
          {placed.map((p) => (
            <a
              key={p.id}
              href={`#point-${p.id}`}
              className="marker"
              style={{ left: `${(p.x as number) * 100}%`, top: `${(p.y as number) * 100}%` }}
              onClick={(e) => {
                if (placing) e.preventDefault();
              }}
            >
              {p.num}
            </a>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="hint">Aucune photo pour cette pièce.</p>
          <label className="btn primary" style={{ display: "inline-flex" }}>
            📷 Ajouter la photo
            <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files)} />
          </label>
        </div>
      )}

      {photoUrl && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className={`btn sm ${placing ? "primary" : ""}`} disabled={busy} onClick={() => setPlacing((v) => !v)}>
            {placing ? "① Touchez la photo…" : "＋ Placer un point"}
          </button>
          <button className="btn sm" disabled={busy} onClick={addFreePoint}>
            ＋ Point libre
          </button>
          <label className="btn sm ghost" style={{ marginLeft: "auto" }}>
            Changer photo
            <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files)} />
          </label>
        </div>
      )}
      {placing && <p className="hint">Touchez la photo à l’endroit du point à créer.</p>}
    </div>
  );
}
