"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Item = { id: string };
type Drag = { index: number; pointerId: number; startY: number; dy: number; target: number; rects: DOMRect[]; height: number };

// Liste réordonnable tactile (glisser-déposer via une POIGNÉE dédiée, pointer
// events, `touch-action: none` sur la poignée). Pas de dépendance externe ;
// même esprit que les autres gestes maison de l'app. Aperçu par insertion :
// la ligne tirée suit le doigt, les autres se décalent pour faire de la place.
export function ReorderableList<T extends Item>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => ReactNode;
}) {
  const [order, setOrder] = useState<T[]>(items);
  const [drag, setDrag] = useState<Drag | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Resynchronise si la liste change côté serveur (après refresh).
  const key = items.map((i) => i.id).join(",");
  useEffect(() => {
    setOrder(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function onDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const rects = rowRefs.current.map((el) => el!.getBoundingClientRect());
    setDrag({ index, pointerId: e.pointerId, startY: e.clientY, dy: 0, target: index, rects, height: rects[index].height });
  }

  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    e.preventDefault();
    const dy = e.clientY - drag.startY;
    const draggedMid = drag.rects[drag.index].top + drag.rects[drag.index].height / 2 + dy;
    let target = drag.rects.filter((r) => r.top + r.height / 2 < draggedMid).length;
    target = Math.max(0, Math.min(order.length - 1, target));
    setDrag({ ...drag, dy, target });
  }

  function onUp(e: React.PointerEvent) {
    if (!drag) return;
    (e.currentTarget as Element).releasePointerCapture?.(drag.pointerId);
    if (drag.target !== drag.index) {
      const next = [...order];
      const [moved] = next.splice(drag.index, 1);
      next.splice(drag.target, 0, moved);
      setOrder(next);
      onReorder(next.map((x) => x.id));
    }
    setDrag(null);
  }

  function rowStyle(j: number): React.CSSProperties {
    if (!drag) return {};
    if (j === drag.index) {
      return { transform: `translateY(${drag.dy}px)`, zIndex: 5, position: "relative", boxShadow: "0 6px 20px rgba(0,0,0,0.5)", opacity: 0.97 };
    }
    let shift = 0;
    if (drag.target > drag.index && j > drag.index && j <= drag.target) shift = -drag.height;
    else if (drag.target < drag.index && j >= drag.target && j < drag.index) shift = drag.height;
    return { transform: `translateY(${shift}px)`, transition: "transform 0.15s ease" };
  }

  return (
    <div className="reorder-list">
      {order.map((item, j) => (
        <div key={item.id} ref={(el) => { rowRefs.current[j] = el; }} className="reorder-row" style={rowStyle(j)}>
          <button
            type="button"
            className="reorder-handle"
            aria-label="Réordonner (glisser)"
            onPointerDown={(e) => onDown(e, j)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            ≡
          </button>
          <div className="reorder-content">{renderItem(item)}</div>
        </div>
      ))}
    </div>
  );
}
