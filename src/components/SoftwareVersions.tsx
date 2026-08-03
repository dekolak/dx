"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadFile } from "@/lib/client";

export type SoftwareVersionData = {
  id: string;
  version: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  note: string | null;
  isCurrent: boolean;
  createdAt: string | Date;
};

function fmtSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Versions téléversées d'un logiciel : upload d'une nouvelle version, liste avec
// téléchargement, marquage « en service », suppression définitive.
export function SoftwareVersions({ softwareItemId, versions }: { softwareItemId: string; versions: SoftwareVersionData[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file || !version.trim()) {
      setError("Choisissez un fichier et saisissez une référence de version.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await uploadFile(file, { kind: "file" });
      await api.createSoftwareVersion({
        softwareItemId,
        version: version.trim(),
        fileUrl: url,
        fileName: file.name,
        fileSize: file.size,
        note: note.trim() || undefined,
      });
      setFile(null);
      setVersion("");
      setNote("");
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload.");
    } finally {
      setBusy(false);
    }
  }

  async function setCurrent(id: string, current: boolean) {
    setBusy(true);
    try {
      await api.setSoftwareVersionCurrent(id, current);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: SoftwareVersionData) {
    if (!confirm(`Supprimer définitivement la version « ${v.version} » et son fichier ?`)) return;
    setBusy(true);
    try {
      await api.deleteSoftwareVersion(v.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button className="btn primary" onClick={() => setOpen(true)} style={{ width: "100%" }}>
          ⬆ Nouvelle version
        </button>
      ) : (
        <div className="card">
          <label>Fichier de la version</label>
          <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <label style={{ marginTop: 10 }}>Référence de version</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex : v1.2.3" maxLength={120} />
          <label style={{ marginTop: 10 }}>Note (facultatif)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex : corrige bug capteur" maxLength={500} />
          {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
          <div className="btn-row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <button className="btn ghost sm" disabled={busy} onClick={() => { setOpen(false); setError(null); }}>
              Annuler
            </button>
            <button className="btn primary sm" disabled={busy || !file || !version.trim()} onClick={submit}>
              {busy ? "Envoi…" : "Téléverser"}
            </button>
          </div>
        </div>
      )}

      <div className="grid" style={{ marginTop: 12 }}>
        {versions.length === 0 && <p className="empty">Aucune version. Téléversez la première.</p>}
        {versions.map((v) => (
          <div key={v.id} className={`card version-card ${v.isCurrent ? "current" : ""}`}>
            <div className="version-head">
              <span className="pill version-pill">{v.version}</span>
              {v.isCurrent && <span className="pill current-pill">✔ en service</span>}
              <span className="version-date">{fmtDate(v.createdAt)}</span>
            </div>
            {v.note && <p className="version-note">{v.note}</p>}
            <div className="version-file">
              <a href={v.fileUrl} download={v.fileName} className="version-download">
                ⬇ {v.fileName}
              </a>
              {v.fileSize != null && <span className="version-size">{fmtSize(v.fileSize)}</span>}
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              {v.isCurrent ? (
                <button className="btn ghost xs" disabled={busy} onClick={() => setCurrent(v.id, false)}>
                  Retirer « en service »
                </button>
              ) : (
                <button className="btn ghost xs" disabled={busy} onClick={() => setCurrent(v.id, true)}>
                  Marquer en service
                </button>
              )}
              <span style={{ flex: 1 }} />
              <button className="btn ghost xs danger" disabled={busy} onClick={() => remove(v)}>
                🗑️ Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
