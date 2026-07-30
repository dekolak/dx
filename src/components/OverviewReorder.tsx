"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { ReorderableList } from "@/components/ReorderableList";

type PhotoRow = { id: string; url: string; label: string | null };

// Panneau de réordonnancement des photos d'ensemble (glisser-déposer tactile).
export function OverviewReorder({ installationId, photos }: { installationId: string; photos: PhotoRow[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onReorder(orderedIds: string[]) {
    setSaving(true);
    try {
      await api.reorderPhotosEnsemble(installationId, orderedIds);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="sub" style={{ marginBottom: 8 }}>
        Ordre des photos {saving && "· enregistrement…"}
      </div>
      <ReorderableList
        items={photos}
        onReorder={onReorder}
        renderItem={(p) => (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="reorder-thumb" />
            <span className="reorder-label">{p.label || "Photo d’ensemble"}</span>
          </>
        )}
      />
    </div>
  );
}
