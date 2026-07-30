"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadFile } from "@/lib/client";
import { ZoomablePhoto, type PhotoMarker } from "@/components/ZoomablePhoto";

type PointMarker = { id: string; num: number; x: number | null; y: number | null };

// Photo annotée d'une PIÈCE : réutilise ZoomablePhoto (zoom/pan/placement) et
// ajoute la gestion de la photo (ajout/changement) et la création de points.
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

  function openNewPoint(id: string) {
    router.refresh();
    window.location.hash = `point-${id}`;
  }

  async function place(x: number, y: number) {
    if (busy) return;
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

  const markers: PhotoMarker[] = points.map((p) => ({ ...p, href: `#point-${p.id}` }));

  if (!photoUrl) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <p className="hint">Aucune photo pour cette pièce.</p>
        <label className="btn primary" style={{ display: "inline-flex" }}>
          📷 Ajouter la photo
          <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files)} />
        </label>
      </div>
    );
  }

  return (
    <div>
      <ZoomablePhoto photoUrl={photoUrl} markers={markers} placing={placing} onPlace={place} alt="Pièce" />
      <p className="hint">
        {placing
          ? "Touchez la photo à l’endroit du point (zoomez d’abord pour plus de précision)."
          : "Pincez pour zoomer · glissez pour déplacer · double-tap pour (dé)zoomer."}
      </p>
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
    </div>
  );
}
