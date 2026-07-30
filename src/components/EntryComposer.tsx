"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Media } from "@/lib/client";
import { MediaUploader } from "@/components/MediaUploader";

// « Ajouter une info » : crée une NOUVELLE entrée empilée (jamais d'écrasement).
// Réutilisé pour point / software / journal via `type` + l'id de rattachement.
export function EntryComposer({
  type,
  pointId,
  softwareItemId,
  linkedPieceId,
  placeholder = "Ajouter une info…",
  submitLabel = "Ajouter une info",
  compact = false,
}: {
  type: "point" | "software" | "journal";
  pointId?: string;
  softwareItemId?: string;
  linkedPieceId?: string;
  placeholder?: string;
  submitLabel?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() && media.length === 0) {
      setError("Ajoute du texte ou un média");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createEntry({ type, text, pointId, softwareItemId, linkedPieceId, media });
      setText("");
      setMedia([]);
      if (compact) setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (compact && !open) {
    return (
      <button className="btn primary" onClick={() => setOpen(true)} style={{ width: "100%" }}>
        ＋ {submitLabel}
      </button>
    );
  }

  return (
    <div className="card">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus={compact}
      />
      <div style={{ marginTop: 8 }}>
        <MediaUploader media={media} onChange={setMedia} />
      </div>
      {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={busy} onClick={submit}>
          {busy ? "…" : submitLabel}
        </button>
        {compact && (
          <button className="btn ghost" onClick={() => setOpen(false)} disabled={busy}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
