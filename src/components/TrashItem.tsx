"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

// Ligne de corbeille : restaurer ou purger définitivement.
export function TrashItem({
  kind,
  id,
  title,
  subtitle,
}: {
  kind: "machine" | "piece" | "point" | "software" | "entry";
  id: string;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    try {
      await api.restore(kind, id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (!confirm("Supprimer DÉFINITIVEMENT ? Cette action est irréversible (médias inclus).")) return;
    setBusy(true);
    try {
      await api.purge(kind, id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="sub" style={{ marginBottom: 2, textTransform: "uppercase", fontSize: 11 }}>{kind}</div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {subtitle && <div className="sub">{subtitle}</div>}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn sm" disabled={busy} onClick={restore}>
          ↩︎ Restaurer
        </button>
        <button className="btn sm danger" disabled={busy} onClick={purge}>
          Supprimer définitivement
        </button>
      </div>
    </div>
  );
}
