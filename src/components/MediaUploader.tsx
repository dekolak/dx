"use client";
import { useRef, useState } from "react";
import { uploadFile, type Media } from "@/lib/client";

// Sélecteur + uploader de médias (photos/vidéos). Composant contrôlé :
// la liste `media` vit dans le parent (EntryComposer / correction d'entrée).
export function MediaUploader({
  media,
  onChange,
}: {
  media: Media[];
  onChange: (m: Media[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: Media[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadFile(file));
      }
      onChange([...media, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {media.length > 0 && (
        <div className="entry media" style={{ marginTop: 8, marginBottom: 8 }}>
          {media.map((m, i) => (
            <div key={i} style={{ position: "relative" }}>
              {m.type === "video" ? <video src={m.url} muted /> : <img src={m.url} alt="" />}
              <button
                type="button"
                className="btn sm danger"
                style={{ position: "absolute", top: 4, right: 4, minHeight: 28, padding: "2px 8px" }}
                onClick={() => onChange(media.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="btn-row">
        <button type="button" className="btn sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Envoi…" : "📷 Ajouter photo / vidéo"}
        </button>
      </div>
      {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
