"use client";
import { useEffect } from "react";
import { EntryCard, type EntryData } from "@/components/EntryCard";

// Modale de détail complet d'une entrée (texte, date, médias, actions).
// Réutilise EntryCard. Se ferme sur le fond, le bouton ✕, Échap, ou après
// suppression de l'entrée.
export function EntryDetailModal({ entry, onClose }: { entry: EntryData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Bloque le scroll de fond tant que la modale est ouverte.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
        <EntryCard entry={entry} onDeleted={onClose} />
      </div>
    </div>
  );
}
