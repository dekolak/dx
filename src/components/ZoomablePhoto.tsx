"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type PhotoMarker = {
  id: string;
  num: number;
  x: number | null;
  y: number | null;
  // Si w ET h sont définis → ZONE (rectangle) au lieu d'une pastille.
  w?: number | null;
  h?: number | null;
  color?: string | null; // couleur de remplissage d'une zone (hex)
  href: string; // "#point-<id>" (info) ou "/pieces/<id>" (raccourci)
  className?: string; // ex "shortcut"
  icon?: string | null; // emoji facultatif affiché dans la pastille/zone
  // Contenu de la bulle d'aperçu (au tap/survol) :
  title?: string;
  meta?: string;
  thumb?: string | null;
  actionLabel?: string;
  links?: { label: string; href: string }[];
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const MIN_ZONE = 0.03; // taille min d'une zone (relative) au tracé
const DOUBLE_TAP_MS = 300;
const ACCENT = "#4f8cff";
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function hexToRgba(hex: string, a: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

type Rect = { x: number; y: number; w?: number; h?: number };

// Cœur réutilisable de la photo annotée : pinch-zoom, pan, pastilles à taille
// écran constante, placement de point, et ZONES (rectangles) qu'on peut tracer,
// déplacer et redimensionner. Ne connaît rien du domaine.
export function ZoomablePhoto({
  photoUrl,
  markers,
  placing,
  onPlace,
  moving = false,
  onMove,
  drawingZone = false,
  onDrawZone,
  alt = "Photo",
}: {
  photoUrl: string;
  markers: PhotoMarker[];
  placing: boolean;
  onPlace: (x: number, y: number) => void;
  moving?: boolean;
  onMove?: (id: string, x: number, y: number, w?: number, h?: number) => void;
  drawingZone?: boolean; // mode « tracer une zone »
  onDrawZone?: (x: number, y: number, w: number, h: number) => void;
  alt?: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Rect>>({});
  const [zoneDraw, setZoneDraw] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [bubble, setBubble] = useState<{ id: string; left: number; top: number; above: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const movingRef = useRef(moving);
  movingRef.current = moving;
  const drawingRef = useRef(drawingZone);
  drawingRef.current = drawingZone;
  const closeTimer = useRef(0);

  const tf = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const g = useRef({
    startX: 0, startY: 0, startTime: 0, prevMidX: 0, prevMidY: 0, prevDist: 0, moved: false, pinched: false,
    onMarker: false, lastTapTime: 0, markerEl: null as HTMLElement | null,
    dragKind: "" as "" | "marker" | "zone-move" | "zone-resize" | "zone-draw",
    dragId: "", dragPointerId: -1, dragMoved: false,
    rect: { x: 0, y: 0, w: 0, h: 0 }, // rect courant (zone) / position (marker)
    grabOx: 0, grabOy: 0, ax: 0, ay: 0, sx: 0, sy: 0,
  });
  const rafId = useRef(0);

  useEffect(() => {
    if (placing || moving || drawingZone) setBubble(null);
  }, [placing, moving, drawingZone]);

  // Coordonnées relatives (0..1) depuis un point écran (rect transformé de l'image).
  const relFrom = useCallback((cx: number, cy: number) => {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clamp((cx - r.left) / r.width, 0, 1), y: clamp((cy - r.top) / r.height, 0, 1) };
  }, []);

  const rectOf = useCallback(
    (id: string): Rect => {
      const o = overrides[id];
      if (o) return o;
      const m = markers.find((mk) => mk.id === id);
      return { x: m?.x ?? 0, y: m?.y ?? 0, w: m?.w ?? undefined, h: m?.h ?? undefined };
    },
    [overrides, markers],
  );

  function openBubble(el: HTMLElement, id: string) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const m = el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    const cx = m.left + m.width / 2 - w.left;
    const cy = m.top - w.top; // haut de la forme
    const half = 118;
    const left = clamp(cx, half, Math.max(half, w.width - half));
    const above = cy > 150;
    setBubble({ id, left, top: above ? cy - 10 : m.bottom - w.top + 10, above });
  }
  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setBubble(null), 180);
  }, []);
  const cancelClose = useCallback(() => window.clearTimeout(closeTimer.current), []);

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
    const s = tf.current.scale;
    tf.current.tx = clamp(tf.current.tx, stage.clientWidth * (1 - s), 0);
    tf.current.ty = clamp(tf.current.ty, stage.clientHeight * (1 - s), 0);
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
      const p = relFrom(clientX, clientY);
      onPlace(p.x, p.y);
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
    if (g.current.dragKind) return; // un geste zone/pastille est déjà en cours
    const t = e.target as Element;
    const handleEl = t.closest?.(".zone-handle") as HTMLElement | null;
    const shapeEl = t.closest?.(".marker, .zone") as HTMLElement | null;

    // 1) Redimensionner une zone (mode déplacer).
    if (movingRef.current && handleEl) {
      const id = handleEl.dataset.pointId!;
      const corner = handleEl.dataset.corner!;
      const r = rectOf(id);
      const w = r.w ?? 0;
      const h = r.h ?? 0;
      // Ancre = coin opposé (fixe pendant le redimensionnement).
      g.current.ax = corner === "nw" || corner === "sw" ? r.x + w : r.x;
      g.current.ay = corner === "nw" || corner === "ne" ? r.y + h : r.y;
      g.current.dragKind = "zone-resize";
      g.current.dragId = id;
      g.current.dragPointerId = e.pointerId;
      g.current.dragMoved = false;
      stageRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    // 2) Déplacer une pastille / zone (mode déplacer).
    if (shapeEl) {
      if (movingRef.current) {
        const id = shapeEl.dataset.pointId!;
        const isZone = shapeEl.classList.contains("zone");
        const r = rectOf(id);
        if (isZone) {
          const p = relFrom(e.clientX, e.clientY);
          g.current.grabOx = p.x - r.x;
          g.current.grabOy = p.y - r.y;
          g.current.rect = { x: r.x, y: r.y, w: r.w ?? 0, h: r.h ?? 0 };
          g.current.dragKind = "zone-move";
        } else {
          g.current.dragKind = "marker";
        }
        g.current.dragId = id;
        g.current.dragPointerId = e.pointerId;
        g.current.dragMoved = false;
        stageRef.current?.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      // Mode normal : tap → bulle.
      g.current.onMarker = true;
      g.current.markerEl = shapeEl;
      return;
    }

    // 3) Tracer une zone (mode zone).
    if (drawingRef.current) {
      const p = relFrom(e.clientX, e.clientY);
      g.current.dragKind = "zone-draw";
      g.current.sx = p.x;
      g.current.sy = p.y;
      g.current.dragPointerId = e.pointerId;
      g.current.dragMoved = false;
      g.current.rect = { x: p.x, y: p.y, w: 0, h: 0 };
      setZoneDraw({ x: p.x, y: p.y, w: 0, h: 0 });
      stageRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    // 4) Pan / pinch.
    g.current.onMarker = false;
    g.current.markerEl = null;
    setBubble(null);
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
    const k = g.current.dragKind;
    if (k && e.pointerId === g.current.dragPointerId) {
      e.preventDefault();
      const p = relFrom(e.clientX, e.clientY);
      if (k === "marker") {
        g.current.rect = { x: p.x, y: p.y, w: 0, h: 0 };
        g.current.dragMoved = true;
        setOverrides((o) => ({ ...o, [g.current.dragId]: { x: p.x, y: p.y } }));
      } else if (k === "zone-move") {
        const { w, h } = g.current.rect;
        const x = clamp(p.x - g.current.grabOx, 0, 1 - w);
        const y = clamp(p.y - g.current.grabOy, 0, 1 - h);
        g.current.rect = { x, y, w, h };
        g.current.dragMoved = true;
        setOverrides((o) => ({ ...o, [g.current.dragId]: { x, y, w, h } }));
      } else if (k === "zone-resize") {
        const x = Math.min(g.current.ax, p.x);
        const y = Math.min(g.current.ay, p.y);
        const w = Math.abs(p.x - g.current.ax);
        const h = Math.abs(p.y - g.current.ay);
        g.current.rect = { x, y, w, h };
        g.current.dragMoved = true;
        setOverrides((o) => ({ ...o, [g.current.dragId]: { x, y, w, h } }));
      } else if (k === "zone-draw") {
        const x = Math.min(g.current.sx, p.x);
        const y = Math.min(g.current.sy, p.y);
        const w = Math.abs(p.x - g.current.sx);
        const h = Math.abs(p.y - g.current.sy);
        g.current.rect = { x, y, w, h };
        g.current.dragMoved = w > MIN_ZONE || h > MIN_ZONE;
        setZoneDraw({ x, y, w, h });
      }
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
      if (Math.abs(e.clientX - g.current.startX) > 8 || Math.abs(e.clientY - g.current.startY) > 8) g.current.moved = true;
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
    const k = g.current.dragKind;
    if (k && e.pointerId === g.current.dragPointerId) {
      const { dragId, dragMoved, rect } = g.current;
      g.current.dragKind = "";
      g.current.dragId = "";
      g.current.dragPointerId = -1;
      stageRef.current?.releasePointerCapture?.(e.pointerId);
      if (k === "zone-draw") {
        setZoneDraw(null);
        if (dragMoved && rect.w > MIN_ZONE && rect.h > MIN_ZONE) onDrawZone?.(rect.x, rect.y, rect.w, rect.h);
      } else if (dragMoved) {
        if (k === "marker") onMove?.(dragId, rect.x, rect.y);
        else onMove?.(dragId, rect.x, rect.y, rect.w, rect.h);
      }
      return;
    }
    if (g.current.onMarker) {
      g.current.onMarker = false;
      if (!placingRef.current && !movingRef.current && !drawingRef.current && g.current.markerEl) {
        openBubble(g.current.markerEl, g.current.markerEl.dataset.pointId ?? "");
      }
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    const single = pointers.current.size === 1;
    const upX = e.clientX;
    const upY = e.clientY;
    pointers.current.delete(e.pointerId);
    stageRef.current?.releasePointerCapture?.(e.pointerId);
    if (pointers.current.size === 0) {
      const isTap = single && !g.current.moved && !g.current.pinched && performance.now() - g.current.startTime < 400;
      if (isTap) handleTap(upX, upY);
      setZoomed(tf.current.scale > 1.01);
      g.current.pinched = false;
    }
  }

  // Survol (souris) : ouvre la bulle ; se referme en quittant la forme et la bulle.
  function onShapeEnter(e: React.PointerEvent, el: HTMLElement, id: string) {
    if (e.pointerType !== "mouse") return;
    if (placingRef.current || movingRef.current || drawingRef.current) return;
    cancelClose();
    openBubble(el, id);
  }
  function onShapeLeave(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    scheduleClose();
  }

  const placed = markers
    .filter((p) => p.x != null && p.y != null)
    .map((p) => {
      const o = overrides[p.id];
      return o ? { ...p, x: o.x, y: o.y, w: o.w ?? p.w, h: o.h ?? p.h } : p;
    });
  const activeMarker = bubble ? markers.find((m) => m.id === bubble.id) : null;
  const CORNERS = ["nw", "ne", "sw", "se"] as const;

  return (
    <div ref={wrapRef} className="annotator-wrap">
      <div
        ref={stageRef}
        className={`annotator ${placing ? "placing" : ""} ${moving ? "moving" : ""} ${drawingZone ? "drawing" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={contentRef} className="annotator-content">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={photoUrl} alt={alt} draggable={false} />

          {placed.map((p) => {
            const isZone = p.w != null && p.h != null;
            const active = bubble?.id === p.id;
            if (isZone) {
              const col = p.color || ACCENT;
              return (
                <a
                  key={p.id}
                  data-point-id={p.id}
                  href={p.href}
                  onClick={(e) => e.preventDefault()}
                  onPointerEnter={(e) => onShapeEnter(e, e.currentTarget, p.id)}
                  onPointerLeave={onShapeLeave}
                  className={`zone ${moving ? "movable" : ""} ${active ? "active" : ""}`}
                  style={{
                    left: `${(p.x as number) * 100}%`,
                    top: `${(p.y as number) * 100}%`,
                    width: `${(p.w as number) * 100}%`,
                    height: `${(p.h as number) * 100}%`,
                    background: hexToRgba(col, 0.22),
                    borderColor: col,
                  }}
                >
                  <span className="zone-label" style={{ background: col }}>
                    {p.icon ? (
                      <>
                        {p.icon}
                        <b className="zone-num">{p.num}</b>
                      </>
                    ) : (
                      p.num
                    )}
                  </span>
                  {p.links && p.links.length > 0 && <span className="zone-link-badge">🔗</span>}
                  {moving &&
                    CORNERS.map((c) => (
                      <span key={c} className={`zone-handle h-${c}`} data-corner={c} data-point-id={p.id} />
                    ))}
                </a>
              );
            }
            return (
              <a
                key={p.id}
                data-point-id={p.id}
                href={p.href}
                onClick={(e) => e.preventDefault()}
                onPointerEnter={(e) => onShapeEnter(e, e.currentTarget, p.id)}
                onPointerLeave={onShapeLeave}
                className={`marker ${p.className ?? ""} ${p.icon ? "has-icon" : ""} ${moving ? "movable" : ""} ${active ? "active" : ""}`}
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
                {p.links && p.links.length > 0 && <span className="marker-link-badge">🔗</span>}
              </a>
            );
          })}

          {zoneDraw && (
            <div
              className="zone zone-preview"
              style={{
                left: `${zoneDraw.x * 100}%`,
                top: `${zoneDraw.y * 100}%`,
                width: `${zoneDraw.w * 100}%`,
                height: `${zoneDraw.h * 100}%`,
              }}
            />
          )}
        </div>
        {zoomed && (
          <button type="button" className="zoom-reset" onClick={resetZoom} aria-label="Réinitialiser le zoom">
            ⟲
          </button>
        )}
      </div>

      {bubble && activeMarker && (
        <div
          className={`marker-bubble ${bubble.above ? "above" : "below"}`}
          style={{ left: bubble.left, top: bubble.top }}
          role="dialog"
          onPointerEnter={cancelClose}
          onPointerLeave={onShapeLeave}
        >
          <button type="button" className="marker-bubble-close" onClick={() => setBubble(null)} aria-label="Fermer">
            ✕
          </button>
          <div className="marker-bubble-head">
            <span className={`marker-bubble-badge ${activeMarker.className ?? ""}`}>{activeMarker.icon || activeMarker.num}</span>
            <span className="marker-bubble-title">{activeMarker.title || `Point ${activeMarker.num}`}</span>
          </div>
          {activeMarker.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="marker-bubble-thumb" src={activeMarker.thumb} alt="" loading="lazy" />
          )}
          {activeMarker.meta && <div className="marker-bubble-meta">{activeMarker.meta}</div>}
          {activeMarker.links && activeMarker.links.length > 0 && (
            <div className="marker-bubble-links">
              {activeMarker.links.map((l, i) => (
                <a key={i} className="marker-bubble-link" href={l.href} onClick={() => setBubble(null)}>
                  🔗 {l.label}
                </a>
              ))}
            </div>
          )}
          <a className="btn xs primary marker-bubble-action" href={activeMarker.href} onClick={() => setBubble(null)}>
            {activeMarker.actionLabel || "Détail ›"}
          </a>
        </div>
      )}
    </div>
  );
}
