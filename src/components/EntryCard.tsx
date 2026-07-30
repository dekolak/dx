"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Media } from "@/lib/client";
import { MediaUploader } from "@/components/MediaUploader";
import { ImageLightbox } from "@/components/ImageLightbox";

export type EntryData = {
  id: string;
  text: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
  shareable: boolean;
  shareToken: string | null;
  media: { id: string; url: string; type: string }[];
};

function fmt(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Le bloc « Entry » réutilisé partout : texte + médias + date + partage + soft delete.
// Deux actions d'édition CLAIREMENT distinctes :
//   - « Corriger » : édite en place cette entrée (coquille).
//   - « Ajouter une info » : géré ailleurs (EntryComposer) = nouvelle entrée empilée.
export function EntryCard({
  entry,
  editable = true,
  onDeleted,
}: {
  entry: EntryData;
  editable?: boolean;
  // Appelé après une suppression réussie (permet ex. de fermer une modale).
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [media, setMedia] = useState<Media[]>(entry.media.map((m) => ({ url: m.url, type: m.type as "photo" | "video" })));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  async function saveCorrection() {
    setBusy(true);
    try {
      await api.correctEntry(entry.id, { text, media });
      setEditing(false);
      router.refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare() {
    setBusy(true);
    try {
      const res = await api.setShare(entry.id, !entry.shareable);
      if (res.shareable && res.shareToken) {
        const url = `${window.location.origin}/s/${res.shareToken}`;
        try {
          await navigator.clipboard.writeText(url);
          flash("Lien de partage copié ✓");
        } catch {
          flash("Partage activé");
        }
      } else {
        flash("Partage désactivé");
      }
      router.refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!confirm("Envoyer cette entrée à la corbeille ?")) return;
    setBusy(true);
    try {
      await api.deleteEntry(entry.id);
      onDeleted?.();
      router.refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const edited = new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 1500;

  if (editing) {
    return (
      <div className="entry">
        <div className="meta">✏️ Correction</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
        <div style={{ marginTop: 8 }}>
          <MediaUploader media={media} onChange={setMedia} />
        </div>
        <div className="actions">
          <button className="btn primary sm" disabled={busy} onClick={saveCorrection}>
            Enregistrer la correction
          </button>
          <button className="btn ghost sm" disabled={busy} onClick={() => setEditing(false)}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="entry">
      <div className="meta">
        <span>{fmt(entry.createdAt)}</span>
        {edited && <span>· corrigé</span>}
        {entry.shareable && <span className="badge-share">· 🔗 partagé</span>}
      </div>
      {entry.text && <div className="text">{entry.text}</div>}
      {entry.media.length > 0 && (
        <div className="media">
          {entry.media.map((m) =>
            m.type === "video" ? (
              <video key={m.id} src={m.url} controls playsInline />
            ) : (
              <button key={m.id} type="button" className="media-open" onClick={() => setZoomSrc(m.url)} aria-label="Agrandir">
                <img src={m.url} alt="" />
              </button>
            ),
          )}
        </div>
      )}
      {editable && (
        <div className="actions">
          <button className="btn ghost sm" disabled={busy} onClick={() => setEditing(true)}>
            ✏️ Corriger
          </button>
          <button className="btn ghost sm" disabled={busy} onClick={toggleShare}>
            {entry.shareable ? "🔗 Partagé" : "🔗 Partager"}
          </button>
          <span className="spacer" />
          <button className="btn ghost sm danger" disabled={busy} onClick={softDelete}>
            🗑️
          </button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {zoomSrc && <ImageLightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  );
}
