"use client";
import { useCallback, useEffect, useRef } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const TAP_MOVE_TOL = 8;
const TAP_MAX_MS = 400;
const DOUBLE_TAP_MS = 300;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Visionneuse plein écran d'une image, avec pinch-to-zoom + pan + double-tap,
// même moteur de gestes que la photo annotée. Fermeture : ✕, Échap, ou tap sur
// le fond quand ce n'est pas zoomé.
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const base = useRef({ w: 0, h: 0 }); // taille « contain » à l'échelle 1
  const tf = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const g = useRef({ startX: 0, startY: 0, startTime: 0, prevMidX: 0, prevMidY: 0, prevDist: 0, moved: false, pinched: false, lastTap: 0 });
  const raf = useRef(0);

  const apply = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const { scale, tx, ty } = tf.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, []);
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      apply();
    });
  }, [apply]);

  const fit = useCallback(() => {
    const el = imgRef.current;
    if (!el || !el.naturalWidth) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / el.naturalWidth, vh / el.naturalHeight);
    base.current = { w: el.naturalWidth * s, h: el.naturalHeight * s };
    el.style.width = `${base.current.w}px`;
    el.style.height = `${base.current.h}px`;
    tf.current = { scale: 1, tx: (vw - base.current.w) / 2, ty: (vh - base.current.h) / 2 };
    apply();
  }, [apply]);

  const clampPan = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sw = base.current.w * tf.current.scale;
    const sh = base.current.h * tf.current.scale;
    tf.current.tx = sw <= vw ? (vw - sw) / 2 : clamp(tf.current.tx, vw - sw, 0);
    tf.current.ty = sh <= vh ? (vh - sh) / 2 : clamp(tf.current.ty, vh - sh, 0);
  }, []);

  function zoomAround(cx: number, cy: number, next: number) {
    const s0 = tf.current.scale;
    const s1 = clamp(next, MIN_SCALE, MAX_SCALE);
    tf.current.tx = cx - (cx - tf.current.tx) * (s1 / s0);
    tf.current.ty = cy - (cy - tf.current.ty) * (s1 / s0);
    tf.current.scale = s1;
    clampPan();
    apply();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", fit);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
      document.body.style.overflow = prev;
    };
  }, [onClose, fit]);

  function onDown(e: React.PointerEvent) {
    // Un appui sur le bouton fermer : laisser le clic natif agir (la capture de
    // pointeur empêcherait sinon le click de se déclencher sur le bouton).
    if ((e.target as Element).closest?.(".lightbox-close")) return;
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

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      e.preventDefault();
      const [p0, p1] = pts;
      const cur = dist(p0, p1) || 1;
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      const s0 = tf.current.scale;
      const s1 = clamp(s0 * (cur / (g.current.prevDist || cur)), MIN_SCALE, MAX_SCALE);
      tf.current.tx = midX - (midX - tf.current.tx) * (s1 / s0) + (midX - g.current.prevMidX);
      tf.current.ty = midY - (midY - tf.current.ty) * (s1 / s0) + (midY - g.current.prevMidY);
      tf.current.scale = s1;
      g.current.prevDist = cur;
      g.current.prevMidX = midX;
      g.current.prevMidY = midY;
      g.current.moved = true;
      g.current.pinched = true;
      clampPan();
      schedule();
    } else if (pts.length === 1) {
      if (Math.abs(e.clientX - g.current.startX) > TAP_MOVE_TOL || Math.abs(e.clientY - g.current.startY) > TAP_MOVE_TOL) g.current.moved = true;
      if (tf.current.scale > 1.01) {
        e.preventDefault();
        tf.current.tx += e.clientX - g.current.prevMidX;
        tf.current.ty += e.clientY - g.current.prevMidY;
        clampPan();
        schedule();
      }
      g.current.prevMidX = e.clientX;
      g.current.prevMidY = e.clientY;
    }
  }

  function onUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const single = pointers.current.size === 1;
    const x = e.clientX;
    const y = e.clientY;
    pointers.current.delete(e.pointerId);
    stageRef.current?.releasePointerCapture?.(e.pointerId);
    if (pointers.current.size !== 0) return;
    const isTap = single && !g.current.moved && !g.current.pinched && performance.now() - g.current.startTime < TAP_MAX_MS;
    if (isTap) {
      const now = performance.now();
      if (now - g.current.lastTap < DOUBLE_TAP_MS) {
        g.current.lastTap = 0;
        if (tf.current.scale > 1.01) fit();
        else zoomAround(x, y, 2.5);
      } else {
        g.current.lastTap = now;
        // Tap simple hors zoom → fermer.
        if (tf.current.scale <= 1.01) onClose();
      }
    }
    g.current.pinched = false;
  }

  return (
    <div
      ref={stageRef}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <button className="lightbox-close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt="" className="lightbox-img" draggable={false} onLoad={fit} />
    </div>
  );
}
