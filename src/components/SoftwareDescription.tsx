"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

// Description longue d'un logiciel (notice / infos générales), éditable en place.
export function SoftwareDescription({ softwareItemId, description }: { softwareItemId: string; description: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.updateSoftware(softwareItemId, { description: value });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="card">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Notice, notes générales, procédure d'installation…"
          rows={6}
          autoFocus
          style={{ width: "100%", resize: "vertical" }}
        />
        <div className="btn-row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
          <button className="btn ghost sm" disabled={busy} onClick={() => { setValue(description ?? ""); setEditing(false); }}>
            Annuler
          </button>
          <button className="btn primary sm" disabled={busy} onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {description ? (
        <p className="software-desc">{description}</p>
      ) : (
        <p className="hint" style={{ margin: 0 }}>Aucune description.</p>
      )}
      <div className="btn-row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
        <button className="btn ghost sm" onClick={() => { setValue(description ?? ""); setEditing(true); }}>
          {description ? "✎ Modifier" : "＋ Ajouter une description"}
        </button>
      </div>
    </div>
  );
}
