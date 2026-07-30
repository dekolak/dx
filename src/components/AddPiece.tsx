"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadFile, type Media } from "@/lib/client";

export function AddPiece({ installationId }: { installationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [photo, setPhoto] = useState<Media | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickPhoto(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    try {
      setPhoto(await uploadFile(files[0]));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createPiece({ installationId, name, category: category || undefined, photoUrl: photo?.url });
      setName("");
      setCategory("");
      setPhoto(null);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn primary" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        ＋ Nouvelle pièce
      </button>
    );
  }
  return (
    <div className="card">
      <label>Nom de la pièce</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Carte mère" autoFocus />
      <label>Catégorie (optionnel)</label>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex : Électronique" />
      <label>Photo principale (annotable ensuite)</label>
      <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files)} />
      {photo && <img src={photo.url} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 8 }} />}
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
