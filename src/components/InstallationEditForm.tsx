"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

type Installation = {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  machineRef: string | null;
  clientRef: string | null;
};

const FIELDS: { key: keyof Omit<Installation, "id">; label: string; placeholder?: string }[] = [
  { key: "name", label: "Nom" },
  { key: "category", label: "Catégorie", placeholder: "ex : Imprimante UV" },
  { key: "brand", label: "Marque" },
  { key: "model", label: "Modèle" },
  { key: "machineRef", label: "Référence machine" },
  { key: "clientRef", label: "Référence client" },
];

// Fiche installation : affichage des infos + édition (nom, catégorie, marque,
// modèle, références). Repliée par défaut.
export function InstallationEditForm({ installation }: { installation: Installation }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    name: installation.name,
    category: installation.category ?? "",
    brand: installation.brand ?? "",
    model: installation.model ?? "",
    machineRef: installation.machineRef ?? "",
    clientRef: installation.clientRef ?? "",
  }));
  const [busy, setBusy] = useState(false);

  const rows = FIELDS.filter((f) => f.key !== "name" && installation[f.key]);

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.updateInstallation(installation.id, form);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="card">
        {rows.length > 0 ? (
          <dl className="info-grid">
            {rows.map((f) => (
              <div key={f.key} className="info-row">
                <dt>{f.label}</dt>
                <dd>{installation[f.key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="hint" style={{ margin: 0 }}>Aucune info détaillée.</p>
        )}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={() => setOpen(true)}>
            ✎ Modifier la fiche
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label>{f.label}</label>
          <input
            value={form[f.key]}
            placeholder={f.placeholder}
            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
          />
        </div>
      ))}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary sm" disabled={busy} onClick={save}>
          Enregistrer
        </button>
        <button className="btn ghost sm" disabled={busy} onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
