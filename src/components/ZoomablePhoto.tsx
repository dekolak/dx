"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type PhotoMarker = {
  id: string;
  num: number;
  x: number | null;
  y: number | null;
  href: string; // "#point-<id>" (info) ou "/pieces/<id>" (raccourci)
  className?: string; // ex "shortcut"
  icon?: string | null; // emoji facultatif affiché dans la pastille
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const TAP_MOVE_TOL = 8;
const TAP_MAX_MS = 400;
const DOUBLE_TAP_MS = 300;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Cœur réutilisable de la photo annotée (pièce OU photo d'ensemble) :
// pinch-to-zoom, pan, double-tap, pastilles à taille écran constante, et
// placement d'un point aux coordonnées EXACTES (rect transformé de l'image).
// Ne connaît rien du domaine : signale un placement via `onPlace(x, y)`.
export function ZoomablePhoto({
  photoUrl,
  markers,
  placing,
  onPlace,
  moving = false,
  onMove,
  alt = "Photo",
}: {
  photoUrl: string;
  markers: PhotoMarker[];
  placing: boolean;
  onPlace: (x: number, y: number) => void;
  moving?: boolean; // mode « déplacer » : on fait glisser les pastilles existantes
  onMove?: (id: string, x: number, y: number) => void;
  alt?: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  // Positions provisoires pendant/après un glisser (optimiste, évite le clignotement
  // le temps que le serveur renvoie les nouvelles coordonnées).
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const movingRef = useRef(moving);
  movingRef.current = moving;

  const tf = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const g = useRef({ startX: 0, startY: 0, startTime: 0, prevMidX: 0, prevMidY: 0, prevDist: 0, moved: false, pinched: false, onMarker: false, lastTapTime: 0, dragId: "" as string, dragPointerId: -1, dragX: 0, dragY: 0, dragMoved: false });
  const rafId = useRef(0);

  const applyTransform = useCallback(() => {
    const c = contentRef.current;
    if (!c) return;
    const { scale, tx, ty } = tf.current;
    c.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    c.style.setProperty("--inv-scale", String(1 / scale));
  }, []);

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

  function handleTap(clientX: number, clientY: number) {
    if (placingRef.current) {
      const el = imgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect(); // reflète zoom + pan
      onPlace(clamp((clientX - rect.left) / rect.width, 0, 1), clamp((clientY - rect.top) / rect.height, 0, 1));
      return;
    }
    const now = performance.now();
    if (now - g.current.lastTapTime < DOUBLE_TAP_MS) {
      g.current.lastTapTime = 0;
      if (tf.current.scale > 1.01) resetZoom();
      else zoomAround(clientX, clientY, 2.5);
    } else {
      g.current.lastTapTime = now;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const markerEl = (e.target as Element).closest?.(".marker") as HTMLElement | null;
    if (markerEl) {
      // Mode « déplacer » : on démarre le glisser de CETTE pastille.
      if (movingRef.current && !g.current.dragId) {
        const id = markerEl.dataset.pointId;
        if (id) {
          g.current.dragId = id;
          g.current.dragPointerId = e.pointerId;
          g.current.dragMoved = false;
          stageRef.current?.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
        return;
      }
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
    // Glisser d'une pastille (mode déplacer) : coords depuis le rect transformé.
    if (g.current.dragId && e.pointerId === g.current.dragPointerId) {
      e.preventDefault();
      const el = imgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      g.current.dragX = x;
      g.current.dragY = y;
      g.current.dragMoved = true;
      const id = g.current.dragId;
      setOverrides((o) => ({ ...o, [id]: { x, y } }));
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
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
      if (Math.abs(e.clientX - g.current.startX) > TAP_MOVE_TOL || Math.abs(e.clientY - g.current.startY) > TAP_MOVE_TOL) g.current.moved = true;
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
    // Fin d'un glisser de pastille → on persiste les nouvelles coordonnées.
    if (g.current.dragId && e.pointerId === g.current.dragPointerId) {
      const id = g.current.dragId;
      const { dragX, dragY, dragMoved } = g.current;
      g.current.dragId = "";
      g.current.dragPointerId = -1;
      stageRef.current?.releasePointerCapture?.(e.pointerId);
      // Un simple tap (sans glisser) ne doit PAS repositionner le point.
      if (dragMoved) onMove?.(id, dragX, dragY);
      return;
    }
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

  const placed = markers
    .filter((p) => p.x != null && p.y != null)
    .map((p) => {
      const o = overrides[p.id];
      return o ? { ...p, x: o.x, y: o.y } : p;
    });

  return (
    <div
      ref={stageRef}
      className={`annotator ${placing ? "placing" : ""} ${moving ? "moving" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={contentRef} className="annotator-content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={photoUrl} alt={alt} draggable={false} />
        {placed.map((p) => (
          <a
            key={p.id}
            data-point-id={p.id}
            href={moving ? undefined : p.href}
            onClick={moving ? (e) => e.preventDefault() : undefined}
            className={`marker ${p.className ?? ""} ${p.icon ? "has-icon" : ""} ${moving ? "movable" : ""}`}
            style={{ left: `${(p.x as number) * 100}%`, top: `${(p.y as number) * 100}%` }}
          >
            {p.icon ? (
              <>
                <span className="marker-glyph">{p.icon}</span>
                <span className="marker-badge">{p.num}</span>
              </>
            ) : (
              <span className="marker-glyph">{p.num}</span>
            )}
          </a>
        ))}
      </div>
      {zoomed && (
        <button type="button" className="zoom-reset" onClick={resetZoom} aria-label="Réinitialiser le zoom">
          ⟲
        </button>
      )}
    </div>
  );
}
