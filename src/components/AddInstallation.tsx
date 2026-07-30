"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

const EMPTY = { name: "", category: "", brand: "", model: "", machineRef: "", clientRef: "" };

export function AddInstallation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  async function submit() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.createInstallation(form);
      setForm(EMPTY);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn primary" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        ＋ Nouvelle installation
      </button>
    );
  }
  return (
    <div className="card">
      <label>Nom</label>
      <input value={form.name} onChange={set("name")} placeholder="ex : DXonJet, Atelier découpe" autoFocus />
      <label>Catégorie (optionnel)</label>
      <input value={form.category} onChange={set("category")} placeholder="ex : Imprimante UV" />
      <label>Marque (optionnel)</label>
      <input value={form.brand} onChange={set("brand")} placeholder="ex : Mimaki" />
      <label>Modèle (optionnel)</label>
      <input value={form.model} onChange={set("model")} placeholder="ex : UJV100-160" />
      <label>Référence machine (optionnel)</label>
      <input value={form.machineRef} onChange={set("machineRef")} placeholder="ex : n° de série" />
      <label>Référence client (optionnel)</label>
      <input value={form.clientRef} onChange={set("clientRef")} placeholder="ex : dossier client" />
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
