import Link from "next/link";
import { notFound } from "next/navigation";
import { getMachine } from "@/lib/data";
import { AddPiece } from "@/components/AddPiece";
import { AddSoftware } from "@/components/AddSoftware";
import { DeleteButton } from "@/components/DeleteButton";
import { MachineActiveToggle } from "@/components/MachineActiveToggle";
import { MachineEditForm } from "@/components/MachineEditForm";

export const dynamic = "force-dynamic";

export default async function MachinePage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;
  const machine = await getMachine(machineId);
  if (!machine) notFound();

  return (
    <>
      <div className="topbar">
        <Link href="/" className="back">
          ‹ Machines
        </Link>
      </div>
      <div className="topbar">
        <h1>{machine.name}</h1>
        <MachineActiveToggle id={machine.id} active={machine.active} />
      </div>
      {machine.category && <div className="crumbs">{machine.category}</div>}

      <div className="section-title">
        <span>Fiche</span>
        <span className="line" />
      </div>
      <MachineEditForm machine={machine} />

      <div className="section-title">
        <span>Pièces</span>
        <span className="line" />
      </div>
      <div className="grid">
        {machine.pieces.length === 0 && <p className="empty">Aucune pièce.</p>}
        {machine.pieces.map((p) => (
          <Link key={p.id} href={`/pieces/${p.id}`} className="tile">
            {p.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
            )}
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              {p.category && <div className="sub">{p.category}</div>}
            </div>
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <AddPiece machineId={machine.id} />
      </div>

      <div className="section-title">
        <span>Software</span>
        <span className="line" />
      </div>
      <div className="grid">
        {machine.softwareItems.length === 0 && <p className="empty">Aucun software.</p>}
        {machine.softwareItems.map((s) => (
          <Link key={s.id} href={`/software/${s.id}`} className="tile">
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <AddSoftware machineId={machine.id} />
      </div>

      <div className="danger-zone">
        <DeleteButton
          kind="machine"
          id={machine.id}
          label="🗑️ Supprimer la machine"
          confirmText="Envoyer cette machine à la corbeille ?"
          redirectTo="/"
          className="btn ghost sm danger"
        />
      </div>
    </>
  );
}
