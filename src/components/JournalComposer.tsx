"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Media } from "@/lib/client";
import { MediaUploader } from "@/components/MediaUploader";

// Ajout rapide de note libre (journal). Texte propre volontairement (pensé pour
// exploitation IA future). Lien optionnel vers une pièce.
export function JournalComposer({ pieces }: { pieces: { id: string; label: string }[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [linkedPieceId, setLinkedPieceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() && media.length === 0) {
      setError("Ajoute une note ou un média");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createEntry({ type: "journal", text, media, linkedPieceId: linkedPieceId || undefined });
      setText("");
      setMedia([]);
      setLinkedPieceId("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Note rapide…" />
      <div style={{ marginTop: 8 }}>
        <MediaUploader media={media} onChange={setMedia} />
      </div>
      {pieces.length > 0 && (
        <>
          <label>Lier à une pièce (optionnel)</label>
          <select value={linkedPieceId} onChange={(e) => setLinkedPieceId(e.target.value)}>
            <option value="">— Aucune —</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </>
      )}
      {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={busy} onClick={submit} style={{ width: "100%" }}>
          {busy ? "…" : "＋ Ajouter au journal"}
        </button>
      </div>
    </div>
  );
}
