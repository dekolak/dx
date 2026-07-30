"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadFile } from "@/lib/client";

type PointMarker = { id: string; num: number; x: number | null; y: number | null };

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const TAP_MOVE_TOL = 8; // px : au-delà, ce n'est plus un tap
const TAP_MAX_MS = 400;
const DOUBLE_TAP_MS = 300;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Photo annotée d'une pièce, optimisée mobile :
//  - pincer pour zoomer/dézoomer, glisser pour déplacer une fois zoomé ;
//  - double-tap pour (dé)zoomer ;
//  - les pastilles gardent une taille écran CONSTANTE (contre-scale 1/zoom) →
//    plus précises par rapport à la photo quand on zoome ;
//  - placement d'un point correct même zoomé (coordonnées calculées à partir du
//    rect TRANSFORMÉ de l'image → jamais décalées par le zoom/pan).
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
  const [zoomed, setZoomed] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const tf = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const g = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    prevMidX: 0,
    prevMidY: 0,
    prevDist: 0,
    moved: false,
    pinched: false,
    onMarker: false,
    lastTapTime: 0,
  });
  const rafId = useRef(0);

  const applyTransform = useCallback(() => {
    const c = contentRef.current;
    if (!c) return;
    const { scale, tx, ty } = tf.current;
    c.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    c.style.setProperty("--inv-scale", String(1 / scale));
  }, []);

  // Ré-applique la transformation après chaque rendu (persiste le zoom après un
  // router.refresh, ex. après avoir ajouté un point en vue zoomée).
  useEffect(() => {
    applyTransform();
  });

  const scheduleApply = useCallback(() => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      applyTransform();
    });
  }, [applyTransform]);

  const clampPan = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const s = tf.current.scale;
    tf.current.tx = clamp(tf.current.tx, w * (1 - s), 0);
    tf.current.ty = clamp(tf.current.ty, h * (1 - s), 0);
  }, []);

  function zoomAround(cx: number, cy: number, nextScale: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const fx = cx - rect.left;
    const fy = cy - rect.top;
    const s0 = tf.current.scale;
    const s1 = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    tf.current.tx = fx - (fx - tf.current.tx) * (s1 / s0);
    tf.current.ty = fy - (fy - tf.current.ty) * (s1 / s0);
    tf.current.scale = s1;
    clampPan();
    applyTransform();
    setZoomed(s1 > 1.01);
  }

  function resetZoom() {
    tf.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform();
    setZoomed(false);
  }

  // --- Placement d'un point (coords depuis le rect transformé de l'image) ---
  async function placeAt(clientX: number, clientY: number) {
    if (busy) return;
    const el = imgRef.current ?? contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect(); // reflète zoom + pan
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    setBusy(true);
    try {
      const pt = await api.createPoint({ pieceId, x, y });
      setPlacing(false);
      openNewPoint((pt as { id: string }).id);
    } finally {
      setBusy(false);
    }
  }

  function handleTap(clientX: number, clientY: number) {
    const now = performance.now();
    if (placing) {
      void placeAt(clientX, clientY);
      return;
    }
    // Hors placement : double-tap = (dé)zoom.
    if (now - g.current.lastTapTime < DOUBLE_TAP_MS) {
      g.current.lastTapTime = 0;
      if (tf.current.scale > 1.01) resetZoom();
      else zoomAround(clientX, clientY, 2.5);
    } else {
      g.current.lastTapTime = now;
    }
  }

  // --- Gestes tactiles / souris (Pointer Events) ---
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Un tap sur une pastille existante : on laisse l'ancre naviguer (ouvre le point).
    if ((e.target as Element).closest?.(".marker")) {
      g.current.onMarker = true;
      return;
    }
    g.current.onMarker = false;
    stageRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      g.current.startX = e.clientX;
      g.current.startY = e.clientY;
      g.current.startTime = performance.now();
      g.current.prevMidX = e.clientX;
      g.current.prevMidY = e.clientY;
      g.current.moved = false;
      g.current.pinched = false;
    } else if (pts.length === 2) {
      g.current.pinched = true;
      g.current.prevDist = dist(pts[0], pts[1]);
      g.current.prevMidX = (pts[0].x + pts[1].x) / 2;
      g.current.prevMidY = (pts[0].y + pts[1].y) / 2;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];

    if (pts.length >= 2) {
      // Pincement : zoom autour du milieu + déplacement du milieu.
      e.preventDefault();
      const [p0, p1] = pts;
      const curDist = dist(p0, p1) || 1;
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      const s0 = tf.current.scale;
      const s1 = clamp(s0 * (curDist / (g.current.prevDist || curDist)), MIN_SCALE, MAX_SCALE);
      const rect = stageRef.current!.getBoundingClientRect();
      const fx = midX - rect.left;
      const fy = midY - rect.top;
      tf.current.tx = fx - (fx - tf.current.tx) * (s1 / s0) + (midX - g.current.prevMidX);
      tf.current.ty = fy - (fy - tf.current.ty) * (s1 / s0) + (midY - g.current.prevMidY);
      tf.current.scale = s1;
      g.current.prevDist = curDist;
      g.current.prevMidX = midX;
      g.current.prevMidY = midY;
      g.current.moved = true;
      g.current.pinched = true;
      clampPan();
      scheduleApply();
    } else if (pts.length === 1) {
      if (Math.abs(e.clientX - g.current.startX) > TAP_MOVE_TOL || Math.abs(e.clientY - g.current.startY) > TAP_MOVE_TOL) {
        g.current.moved = true;
      }
      // Déplacement (pan) uniquement quand c'est zoomé.
      if (tf.current.scale > 1.01) {
        e.preventDefault();
        tf.current.tx += e.clientX - g.current.prevMidX;
        tf.current.ty += e.clientY - g.current.prevMidY;
        clampPan();
        scheduleApply();
      }
      g.current.prevMidX = e.clientX;
      g.current.prevMidY = e.clientY;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (g.current.onMarker) {
      g.current.onMarker = false;
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    const single = pointers.current.size === 1;
    const upX = e.clientX;
    const upY = e.clientY;
    pointers.current.delete(e.pointerId);
    stageRef.current?.releasePointerCapture?.(e.pointerId);

    if (pointers.current.size === 0) {
      const isTap = single && !g.current.moved && !g.current.pinched && performance.now() - g.current.startTime < TAP_MAX_MS;
      if (isTap) handleTap(upX, upY);
      setZoomed(tf.current.scale > 1.01);
      g.current.pinched = false;
    }
  }

  async function setPhoto(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    try {
      const media = await uploadFile(files[0]);
      await api.updatePiece(pieceId, { photoUrl: media.url });
      resetZoom();
      router.refresh();
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

  // Cible l'ancre du nouveau point : CollapsiblePoint écoute le hash et se
  // déplie + scrolle automatiquement dessus.
  function openNewPoint(id: string) {
    router.refresh();
    window.location.hash = `point-${id}`;
  }

  const placed = points.filter((p) => p.x != null && p.y != null);

  return (
    <div>
      {photoUrl ? (
        <>
          <div
            ref={stageRef}
            className={`annotator ${placing ? "placing" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div ref={contentRef} className="annotator-content">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={photoUrl} alt="Pièce" draggable={false} />
              {placed.map((p) => (
                <a
                  key={p.id}
                  href={`#point-${p.id}`}
                  className="marker"
                  style={{ left: `${(p.x as number) * 100}%`, top: `${(p.y as number) * 100}%` }}
                >
                  {p.num}
                </a>
              ))}
            </div>
            {zoomed && (
              <button
                type="button"
                className="zoom-reset"
                onClick={resetZoom}
                aria-label="Réinitialiser le zoom"
              >
                ⟲
              </button>
            )}
          </div>
          <p className="hint">
            {placing
              ? "Touchez la photo à l’endroit du point (zoomez d’abord pour plus de précision)."
              : "Pincez pour zoomer · glissez pour déplacer · double-tap pour (dé)zoomer."}
          </p>
        </>
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
    </div>
  );
}
