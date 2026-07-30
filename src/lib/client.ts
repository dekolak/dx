"use client";

// Petit client fetch pour les mutations depuis les composants client.
// Toutes les routes API sont protégées par le middleware (cookie de session).

export type Media = { url: string; type: "photo" | "video" };

async function req<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  return data as T;
}

export const api = {
  createMachine: (b: { name: string; category?: string }) => req("/api/machines", "POST", b),
  updateMachine: (id: string, b: Record<string, unknown>) => req(`/api/machines/${id}`, "PATCH", b),
  deleteMachine: (id: string) => req(`/api/machines/${id}`, "DELETE"),

  createPiece: (b: { machineId: string; name: string; category?: string; photoUrl?: string }) =>
    req("/api/pieces", "POST", b),
  updatePiece: (id: string, b: Record<string, unknown>) => req(`/api/pieces/${id}`, "PATCH", b),
  deletePiece: (id: string) => req(`/api/pieces/${id}`, "DELETE"),

  createPoint: (b: { pieceId: string; x?: number; y?: number }) => req("/api/points", "POST", b),
  updatePoint: (id: string, b: Record<string, unknown>) => req(`/api/points/${id}`, "PATCH", b),
  deletePoint: (id: string) => req(`/api/points/${id}`, "DELETE"),

  createSoftware: (b: { machineId: string; name: string }) => req("/api/software", "POST", b),
  deleteSoftware: (id: string) => req(`/api/software/${id}`, "DELETE"),

  createEntry: (b: {
    type: "point" | "software" | "journal";
    text: string;
    pointId?: string;
    softwareItemId?: string;
    linkedPieceId?: string;
    media?: Media[];
  }) => req("/api/entries", "POST", b),
  correctEntry: (id: string, b: { text?: string; media?: Media[] }) => req(`/api/entries/${id}`, "PATCH", b),
  deleteEntry: (id: string) => req(`/api/entries/${id}`, "DELETE"),
  setShare: (id: string, shareable: boolean) =>
    req<{ shareToken: string | null; shareable: boolean }>(`/api/entries/${id}/share`, "POST", { shareable }),

  restore: (kind: string, id: string) => req(`/api/trash/${kind}/${id}`, "POST"),
  purge: (kind: string, id: string) => req(`/api/trash/${kind}/${id}`, "DELETE"),
};

/** Upload d'un fichier vers le disque local du serveur. Retourne le média. */
export async function uploadFile(file: File): Promise<Media> {
  const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Échec de l'upload du média");
  return { url: (data as Media).url, type: (data as Media).type };
}
