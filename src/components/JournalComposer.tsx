"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Media } from "@/lib/client";
import { MediaUploader } from "@/components/MediaUploader";

export type JournalTargets = {
  installations: { id: string; label: string }[];
  pieces: { id: string; label: string }[];
  software: { id: string; label: string }[];
};

// Décode la valeur "kind:id" du <select> en champ de lien.
export function linkFromValue(value: string): {
  linkedPieceId?: string;
  linkedInstallationId?: string;
  linkedSoftwareItemId?: string;
} {
  const [kind, id] = value.split(":");
  if (!id) return {};
  if (kind === "piece") return { linkedPieceId: id };
  if (kind === "installation") return { linkedInstallationId: id };
  if (kind === "software") return { linkedSoftwareItemId: id };
  return {};
}

// Sélecteur de cible réutilisable (installations / pièces / logiciels).
export function TargetSelect({ targets, value, onChange }: { targets: JournalTargets; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Aucun lien —</option>
      {targets.installations.length > 0 && (
        <optgroup label="Installations">
          {targets.installations.map((t) => (
            <option key={t.id} value={`installation:${t.id}`}>{t.label}</option>
          ))}
        </optgroup>
      )}
      {targets.pieces.length > 0 && (
        <optgroup label="Pièces">
          {targets.pieces.map((t) => (
            <option key={t.id} value={`piece:${t.id}`}>{t.label}</option>
          ))}
        </optgroup>
      )}
      {targets.software.length > 0 && (
        <optgroup label="Logiciels">
          {targets.software.map((t) => (
            <option key={t.id} value={`software:${t.id}`}>{t.label}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// Ajout rapide de note libre (journal). Lien optionnel vers une installation,
// une pièce ou un logiciel.
export function JournalComposer({ targets }: { targets: JournalTargets }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTargets = targets.installations.length + targets.pieces.length + targets.software.length > 0;

  async function submit() {
    if (!text.trim() && media.length === 0) {
      setError("Ajoute une note ou un média");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createEntry({ type: "journal", text, media, ...linkFromValue(target) });
      setText("");
      setMedia([]);
      setTarget("");
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
      {hasTargets && (
        <>
          <label>Lier à (optionnel)</label>
          <TargetSelect targets={targets} value={target} onChange={setTarget} />
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
