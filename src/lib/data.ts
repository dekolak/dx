import "server-only";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/auth";

// Couche de lecture, TOUJOURS scopée par organizationId. Les composants serveur
// appellent ces helpers ; ils ne touchent jamais Prisma sans passer par le
// scope org (garantie multi-tenant dès aujourd'hui).

export type EntryWithMedia = Awaited<ReturnType<typeof getEntry>>;

const entryInclude = { media: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } as const;

export async function listMachines() {
  const organizationId = await requireOrgId();
  return prisma.machine.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { pieces: { where: { deletedAt: null } }, softwareItems: { where: { deletedAt: null } } } },
    },
  });
}

export async function getMachine(machineId: string) {
  const organizationId = await requireOrgId();
  return prisma.machine.findFirst({
    where: { id: machineId, organizationId, deletedAt: null },
    include: {
      pieces: { where: { deletedAt: null }, orderBy: { name: "asc" } },
      softwareItems: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getPiece(pieceId: string) {
  const organizationId = await requireOrgId();
  return prisma.piece.findFirst({
    where: { id: pieceId, deletedAt: null, machine: { organizationId } },
    include: {
      machine: true,
      points: {
        where: { deletedAt: null },
        orderBy: { num: "asc" },
        include: {
          entries: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            include: entryInclude,
          },
        },
      },
    },
  });
}

export async function getSoftwareItem(softwareItemId: string) {
  const organizationId = await requireOrgId();
  return prisma.softwareItem.findFirst({
    where: { id: softwareItemId, deletedAt: null, machine: { organizationId } },
    include: {
      machine: true,
      entries: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: entryInclude },
    },
  });
}

export async function listJournal() {
  const organizationId = await requireOrgId();
  return prisma.entry.findMany({
    where: { organizationId, type: "journal", deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { ...entryInclude, linkedPiece: { include: { machine: true } } },
  });
}

/** Liste plate des pièces (pour le sélecteur de lien du journal). */
export async function listPiecesForPicker() {
  const organizationId = await requireOrgId();
  const pieces = await prisma.piece.findMany({
    where: { deletedAt: null, machine: { organizationId } },
    orderBy: [{ machine: { name: "asc" } }, { name: "asc" }],
    include: { machine: { select: { name: true } } },
  });
  return pieces.map((p) => ({ id: p.id, label: `${p.machine.name} — ${p.name}` }));
}

export async function getEntry(entryId: string) {
  const organizationId = await requireOrgId();
  return prisma.entry.findFirst({
    where: { id: entryId, organizationId },
    include: entryInclude,
  });
}

/** Contenu de la corbeille : entrées + éléments de structure soft-deleted. */
export async function listTrash() {
  const organizationId = await requireOrgId();
  const [machines, pieces, points, softwareItems, entries] = await Promise.all([
    prisma.machine.findMany({ where: { organizationId, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
    prisma.piece.findMany({
      where: { deletedAt: { not: null }, machine: { organizationId } },
      orderBy: { deletedAt: "desc" },
      include: { machine: true },
    }),
    prisma.point.findMany({
      where: { deletedAt: { not: null }, piece: { machine: { organizationId } } },
      orderBy: { deletedAt: "desc" },
      include: { piece: true },
    }),
    prisma.softwareItem.findMany({
      where: { deletedAt: { not: null }, machine: { organizationId } },
      orderBy: { deletedAt: "desc" },
      include: { machine: true },
    }),
    prisma.entry.findMany({
      where: { organizationId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: entryInclude,
    }),
  ]);
  return { machines, pieces, points, softwareItems, entries };
}

/** Résolution d'une entrée partagée par token (usage page publique, hors scope org). */
export async function getSharedEntry(shareToken: string) {
  return prisma.entry.findFirst({
    where: { shareToken, shareable: true, deletedAt: null },
    include: {
      ...entryInclude,
      point: { include: { piece: { include: { machine: true } } } },
      softwareItem: { include: { machine: true } },
      linkedPiece: { include: { machine: true } },
    },
  });
}
