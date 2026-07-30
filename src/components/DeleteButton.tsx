"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

const fn = {
  machine: api.deleteMachine,
  piece: api.deletePiece,
  point: api.deletePoint,
  software: api.deleteSoftware,
  entry: api.deleteEntry,
} as const;

// Soft-delete générique (-> corbeille). `redirectTo` pour quitter une page dont
// l'objet vient d'être supprimé.
export function DeleteButton({
  kind,
  id,
  label = "🗑️ Supprimer",
  confirmText = "Envoyer à la corbeille ?",
  redirectTo,
  className = "btn ghost sm danger",
}: {
  kind: keyof typeof fn;
  id: string;
  label?: string;
  confirmText?: string;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(confirmText)) return;
    setBusy(true);
    try {
      await fn[kind](id);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={className} disabled={busy} onClick={onClick}>
      {label}
    </button>
  );
}
