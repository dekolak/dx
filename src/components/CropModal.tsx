"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeOriented, exportCropJpeg, jpegName, type SourceCrop } from "@/lib/image";

const HANDLE = 16; // rayon de préhension (tactile)
const MIN = 40; // taille mini de sélection (px écran)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Sel = { x: number; y: number; w: number; h: number };

// Éditeur de recadrage simple : rectangle de sélection ajustable (déplacer,
// redimensionner par les coins, ou retracer). À la validation → recadrage +
// redimensionnement + compression JPEG, puis renvoi du fichier prêt à uploader.
export function CropModal({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (result: File) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bmpRef = useRef<ImageBitmap | null>(null);
  const selRef = useRef<Sel>({ x: 0, y: 0, w: 0, h: 0 });
  const dispRef = useRef({ w: 0, h: 0, scale: 1 }); // display size + source→display scale
  const drag = useRef<{ mode: "move" | "new" | "nw" | "ne" | "sw" | "se" | null; ox: number; oy: number; start: Sel }>({
    mode: null,
    ox: 0,
    oy: 0,
    start: { x: 0, y: 0, w: 0, h: 0 },
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const bmp = bmpRef.current;
    if (!canvas || !bmp) return;
    const { w, h } = dispRef.current;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const s = selRef.current;
    // Assombrit l'extérieur de la sélection (4 bandes).
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, w, s.y);
    ctx.fillRect(0, s.y + s.h, w, h - (s.y + s.h));
    ctx.fillRect(0, s.y, s.x, s.h);
    ctx.fillRect(s.x + s.w, s.y, w - (s.x + s.w), s.h);
    // Cadre + coins.
    ctx.strokeStyle = "#4f8cff";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = "#fff";
    for (const [cx, cy] of [
      [s.x, s.y],
      [s.x + s.w, s.y],
      [s.x, s.y + s.h],
      [s.x + s.w, s.y + s.h],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#4f8cff";
      ctx.stroke();
    }
  }, []);

  // Décodage + calcul de la taille d'affichage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bmp = await decodeOriented(file);
        if (cancelled) return;
        bmpRef.current = bmp;
        const maxW = Math.min(window.innerWidth - 48, 520);
        const maxH = window.innerHeight * 0.6;
        let scale = maxW / bmp.width;
        if (bmp.height * scale > maxH) scale = maxH / bmp.height;
        scale = Math.min(scale, 1);
        const w = Math.round(bmp.width * scale);
        const h = Math.round(bmp.height * scale);
        dispRef.current = { w, h, scale };
        // Sélection initiale : image entière.
        selRef.current = { x: 0, y: 0, w, h };
        const canvas = canvasRef.current!;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        setReady(true);
        requestAnimationFrame(draw);
      } catch {
        setError("Image illisible");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, draw]);

  function pos(e: React.PointerEvent) {
    // Le canvas peut être mis à l'échelle par le CSS (max-width) : on ramène les
    // coordonnées client vers l'espace LOGIQUE du canvas (dispRef), sinon les
    // poignées ne tombent pas au bon endroit.
    const r = canvasRef.current!.getBoundingClientRect();
    const sx = dispRef.current.w / (r.width || 1);
    const sy = dispRef.current.h / (r.height || 1);
    return {
      x: clamp((e.clientX - r.left) * sx, 0, dispRef.current.w),
      y: clamp((e.clientY - r.top) * sy, 0, dispRef.current.h),
    };
  }
  function near(px: number, py: number, cx: number, cy: number) {
    return Math.hypot(px - cx, py - cy) <= HANDLE;
  }

  function onPointerDown(e: React.PointerEvent) {
    canvasRef.current!.setPointerCapture(e.pointerId);
    const p = pos(e);
    const s = selRef.current;
    let mode: typeof drag.current.mode = null;
    if (near(p.x, p.y, s.x, s.y)) mode = "nw";
    else if (near(p.x, p.y, s.x + s.w, s.y)) mode = "ne";
    else if (near(p.x, p.y, s.x, s.y + s.h)) mode = "sw";
    else if (near(p.x, p.y, s.x + s.w, s.y + s.h)) mode = "se";
    else if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) mode = "move";
    else mode = "new";
    drag.current = { mode, ox: p.x, oy: p.y, start: { ...s } };
    if (mode === "new") selRef.current = { x: p.x, y: p.y, w: 0, h: 0 };
    draw();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.mode) return;
    e.preventDefault();
    const p = pos(e);
    const { w: DW, h: DH } = dispRef.current;
    const st = drag.current.start;
    const s = { ...selRef.current };
    const dx = p.x - drag.current.ox;
    const dy = p.y - drag.current.oy;
    switch (drag.current.mode) {
      case "move":
        s.x = clamp(st.x + dx, 0, DW - st.w);
        s.y = clamp(st.y + dy, 0, DH - st.h);
        s.w = st.w;
        s.h = st.h;
        break;
      case "new": {
        const x0 = clamp(drag.current.ox, 0, DW);
        const y0 = clamp(drag.current.oy, 0, DH);
        s.x = Math.min(x0, p.x);
        s.y = Math.min(y0, p.y);
        s.w = Math.abs(p.x - x0);
        s.h = Math.abs(p.y - y0);
        break;
      }
      default: {
        // Coins : bord fixe = coin opposé.
        const left = drag.current.mode === "nw" || drag.current.mode === "sw";
        const top = drag.current.mode === "nw" || drag.current.mode === "ne";
        const fixedX = left ? st.x + st.w : st.x;
        const fixedY = top ? st.y + st.h : st.y;
        const curX = clamp(p.x, 0, DW);
        const curY = clamp(p.y, 0, DH);
        s.x = Math.min(fixedX, curX);
        s.y = Math.min(fixedY, curY);
        s.w = Math.abs(fixedX - curX);
        s.h = Math.abs(fixedY - curY);
      }
    }
    selRef.current = s;
    draw();
  }

  function onPointerUp(e: React.PointerEvent) {
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    // Ignore une sélection trop petite (retombe sur l'image entière).
    const s = selRef.current;
    if (s.w < MIN || s.h < MIN) {
      selRef.current = { x: 0, y: 0, w: dispRef.current.w, h: dispRef.current.h };
      draw();
    }
    drag.current.mode = null;
  }

  function selectAll() {
    selRef.current = { x: 0, y: 0, w: dispRef.current.w, h: dispRef.current.h };
    draw();
  }

  async function confirm() {
    const bmp = bmpRef.current;
    if (!bmp) return;
    setBusy(true);
    setError(null);
    try {
      const { scale } = dispRef.current;
      const s = selRef.current;
      const crop: SourceCrop = {
        sx: Math.round(s.x / scale),
        sy: Math.round(s.y / scale),
        sw: Math.round(s.w / scale),
        sh: Math.round(s.h / scale),
      };
      const blob = await exportCropJpeg(bmp, crop);
      onDone(new File([blob], jpegName(file.name), { type: "image/jpeg" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du recadrage");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: 560, paddingTop: 12 }}>
        <p className="sub" style={{ margin: "0 0 10px" }}>
          Recadrez la photo (déplacez / ajustez les coins), ou gardez tout.
        </p>
        {!ready && !error && <p className="hint">Chargement…</p>}
        {error && (
          <div>
            <p className="hint" style={{ color: "var(--danger)" }}>
              {error} — format non pris en charge pour le recadrage.
            </p>
            <div className="btn-row">
              <button className="btn sm" onClick={() => onDone(file)}>
                Envoyer sans recadrer
              </button>
              <button className="btn ghost sm" onClick={onCancel}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {!error && (
          <>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <canvas
                ref={canvasRef}
                className="crop-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" disabled={busy || !ready} onClick={confirm}>
                {busy ? "…" : "✓ Recadrer & envoyer"}
              </button>
              <button className="btn sm" disabled={busy || !ready} onClick={selectAll}>
                Tout garder
              </button>
              <span style={{ flex: 1 }} />
              <button className="btn ghost sm" disabled={busy} onClick={onCancel}>
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
