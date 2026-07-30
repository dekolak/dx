import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedEntry } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function fmt(d: Date) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// Page publique (sans login) d'une entrée partagée.
export default async function SharedEntryPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const entry = await getSharedEntry(shareToken);
  if (!entry) notFound();

  // Contexte lisible selon le rattachement de l'entrée.
  let context: string | null = null;
  if (entry.point) context = `${entry.point.piece.installation.name} · ${entry.point.piece.name} · Point ${entry.point.num}`;
  else if (entry.softwareItem) context = `${entry.softwareItem.installation.name} · ${entry.softwareItem.name}`;
  else if (entry.linkedPiece) context = `${entry.linkedPiece.installation.name} · ${entry.linkedPiece.name}`;

  return (
    <div className="share-wrap">
      <div className="share-header">
        {context && <div className="pill" style={{ marginBottom: 10 }}>{context}</div>}
        <div className="sub">{fmt(entry.createdAt)}</div>
      </div>

      {entry.text && <div className="entry text" style={{ fontSize: 16 }}>{entry.text}</div>}

      {entry.media.length > 0 && (
        <div className="entry media" style={{ marginTop: 16 }}>
          {entry.media.map((m) =>
            m.type === "video" ? (
              <video key={m.id} src={m.url} controls playsInline style={{ height: 220 }} />
            ) : (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" style={{ height: 220 }} />
              </a>
            ),
          )}
        </div>
      )}

      <p className="fab-hint" style={{ marginTop: 40, textAlign: "center" }}>
        Partagé via DX — Référencement technique
      </p>
    </div>
  );
}
