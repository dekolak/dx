"use client";
import { useEffect, useState } from "react";
import type { EntryData } from "@/components/EntryCard";
import { CollapsiblePoint, type LinkChip, type LinkTargetPiece } from "@/components/CollapsiblePoint";

type Item = {
  point: { id: string; num: number; x: number | null; y: number | null; icon?: string | null };
  entries: EntryData[];
  links?: LinkChip[];
};

// Accordéon des points : un seul ouvert à la fois. Ouvre aussi automatiquement
// le point ciblé par l'ancre #point-<id> (clic sur un marqueur / point créé).
// `linkTargets` (facultatif) active la liaison de repères (cf. CollapsiblePoint).
export function PointsAccordion({ items, linkTargets }: { items: Item[]; linkTargets?: LinkTargetPiece[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const h = window.location.hash;
      if (h.startsWith("#point-")) setOpenId(h.slice("#point-".length));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="grid">
      {items.map(({ point, entries, links }) => (
        <CollapsiblePoint
          key={point.id}
          point={point}
          entries={entries}
          links={links}
          linkTargets={linkTargets}
          open={openId === point.id}
          onToggle={() => setOpenId((cur) => (cur === point.id ? null : point.id))}
        />
      ))}
    </div>
  );
}
