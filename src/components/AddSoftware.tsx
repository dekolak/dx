"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function AddSoftware({ machineId }: { machineId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createSoftware({ machineId, name });
      setName("");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn sm" onClick={() => setOpen(true)}>
        ＋ Software
      </button>
    );
  }
  return (
    <div className="card">
      <label>Nom / logiciel</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Firmware carte, RIP…" autoFocus />
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
