"use client";
import { useRef, useState } from "react";
import { uploadFile, type Media } from "@/lib/client";
import { CropModal } from "@/components/CropModal";

// Sélecteur + uploader de médias pour les ENTRÉES. Les photos passent par
// l'éditeur de recadrage (crop + redimensionnement + compression JPEG) avant
// l'envoi ; les vidéos sont envoyées telles quelles. Composant contrôlé :
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
  const [cropFile, setCropFile] = useState<File | null>(null);
  const resolverRef = useRef<((f: File | null) => void) | null>(null);

  // Ouvre l'éditeur de recadrage et attend le fichier traité (ou null si annulé).
  function cropImage(file: File): Promise<File | null> {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setCropFile(file);
    });
  }
  function finishCrop(result: File | null) {
    setCropFile(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    if (inputRef.current) inputRef.current.value = "";
    setError(null);
    try {
      const uploaded: Media[] = [];
      for (const file of list) {
        if (file.type.startsWith("image/")) {
          // Recadrage/compression AVANT upload (bloque tant que la modale est ouverte).
          const processed = await cropImage(file);
          if (!processed) continue; // annulé pour ce fichier
          setBusy(true);
          uploaded.push(await uploadFile(processed));
          setBusy(false);
        } else {
          // Vidéo (ou autre) : envoi direct, sans traitement.
          setBusy(true);
          uploaded.push(await uploadFile(file));
          setBusy(false);
        }
      }
      if (uploaded.length) onChange([...media, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setBusy(false);
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

      {cropFile && <CropModal file={cropFile} onDone={(f) => finishCrop(f)} onCancel={() => finishCrop(null)} />}
    </div>
  );
}
