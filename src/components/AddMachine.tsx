"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function AddMachine() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createMachine({ name, category: category || undefined });
      setName("");
      setCategory("");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn primary" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        ＋ Nouvelle machine
      </button>
    );
  }
  return (
    <div className="card">
      <label>Nom</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : DXonJet" autoFocus />
      <label>Catégorie (optionnel)</label>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex : Imprimante UV" />
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={busy} onClick={submit}>
          Créer
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
