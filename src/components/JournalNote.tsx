"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { EntryCard, type EntryData } from "@/components/EntryCard";
import { TargetSelect, linkFromValue, type JournalTargets } from "@/components/JournalComposer";

export type JournalEntry = EntryData & {
  linkedPiece: { id: string; name: string; installation: { name: string } } | null;
  linkedInstallation: { id: string; name: string } | null;
  linkedSoftware: { id: string; name: string; installation: { name: string } } | null;
};

// Décrit le lien courant d'une note : cible d'affichage + valeur du <select>.
export function describeLink(e: JournalEntry): { href: string; label: string; kind: string; value: string } | null {
  if (e.linkedPiece) {
    return {
      href: `/pieces/${e.linkedPiece.id}`,
      label: `${e.linkedPiece.installation.name} — ${e.linkedPiece.name}`,
      kind: "Pièce",
      value: `piece:${e.linkedPiece.id}`,
    };
  }
  if (e.linkedInstallation) {
    return { href: `/installations/${e.linkedInstallation.id}`, label: e.linkedInstallation.name, kind: "Installation", value: `installation:${e.linkedInstallation.id}` };
  }
  if (e.linkedSoftware) {
    return {
      href: `/software/${e.linkedSoftware.id}`,
      label: `${e.linkedSoftware.installation.name} — ${e.linkedSoftware.name}`,
      kind: "Logiciel",
      value: `software:${e.linkedSoftware.id}`,
    };
  }
  return null;
}

export function JournalNote({ entry, targets }: { entry: JournalEntry; targets: JournalTargets }) {
  const router = useRouter();
  const link = describeLink(entry);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(link?.value ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.relinkEntry(entry.id, linkFromValue(value));
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {editing ? (
        <div className="journal-link-edit">
          <TargetSelect targets={targets} value={value} onChange={setValue} />
          <div className="btn-row" style={{ marginTop: 6, justifyContent: "flex-end" }}>
            <button className="btn ghost xs" disabled={busy} onClick={() => { setValue(link?.value ?? ""); setEditing(false); }}>
              Annuler
            </button>
            <button className="btn primary xs" disabled={busy} onClick={save}>
              OK
            </button>
          </div>
        </div>
      ) : (
        <div className="crumbs journal-link-row" style={{ marginBottom: 4 }}>
          {link ? (
            <>
              🔗 {link.kind} :{" "}
              <Link href={link.href} style={{ color: "var(--accent)" }}>{link.label}</Link>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>Note libre</span>
          )}
          <button className="btn ghost xs journal-link-edit-btn" onClick={() => setEditing(true)}>
            ✎ lien
          </button>
        </div>
      )}
      <EntryCard entry={entry} />
    </div>
  );
}
