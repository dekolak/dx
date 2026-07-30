"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

// Bascule « active » d'une machine (vue principale) vs « autres ».
export function MachineActiveToggle({
  id,
  active,
  className = "btn xs",
}: {
  id: string;
  active: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await api.updateMachine(id, { active: !active });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`${className} ${active ? "primary" : "ghost"}`}
      disabled={busy}
      onClick={toggle}
      title={active ? "Machine active (dans la vue principale)" : "Machine hors vue principale"}
    >
      {active ? "★ Active" : "☆ Activer"}
    </button>
  );
}
