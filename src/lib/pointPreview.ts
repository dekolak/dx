// Aperçu d'un point pour la bulle sur l'image et l'en-tête d'accordéon :
// dernière info (titre court), compteurs, et première vignette photo.

type PreviewEntry = { text: string; media: { type: string; url: string }[] };

export function snippet(text: string, n = 60): string {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export function pointPreview(entries: PreviewEntry[]): { title: string; meta: string; thumb: string | null } {
  const latest = entries[entries.length - 1];
  const photoCount = entries.reduce((n, e) => n + e.media.filter((m) => m.type === "photo").length, 0);
  const title = latest ? snippet(latest.text) || "(média)" : "Aucune info";
  const meta = `${entries.length} info${entries.length > 1 ? "s" : ""}${photoCount > 0 ? ` · ${photoCount} 📷` : ""}`;
  const thumb = entries.flatMap((e) => e.media).find((m) => m.type === "photo")?.url ?? null;
  return { title, meta, thumb };
}
