"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadFile } from "@/lib/client";

// Ajoute une photo d'ensemble à une installation (pleine résolution, comme la
// photo annotée d'une pièce — pas de recadrage/compression, pour le zoom précis).
export function AddPhotoEnsemble({ installationId }: { installationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    setError(null);
    try {
      const media = await uploadFile(files[0]);
      await api.createPhotoEnsemble({ installationId, url: media.url });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'ajout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="btn primary" style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Envoi…" : "＋ Ajouter une photo d’ensemble"}
        <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => pick(e.target.files)} />
      </label>
      {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
