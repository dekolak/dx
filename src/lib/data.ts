import "server-only";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/auth";

// Couche de lecture, TOUJOURS scopée par organizationId. Les composants serveur
// appellent ces helpers ; ils ne touchent jamais Prisma sans passer par le
// scope org (garantie multi-tenant dès aujourd'hui).

export type EntryWithMedia = Awaited<ReturnType<typeof getEntry>>;

const entryInclude = { media: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } as const;

export async function listInstallations(opts?: { includeInactive?: boolean }) {
  const organizationId = await requireOrgId();
  return prisma.installation.findMany({
    where: { organizationId, deletedAt: null, ...(opts?.includeInactive ? {} : { active: true }) },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { pieces: { where: { deletedAt: null } }, softwareItems: { where: { deletedAt: null } } } },
    },
  });
}

/** Compte des installations actives / inactives (pour l'entête de la vue principale). */
export async function installationCounts() {
  const organizationId = await requireOrgId();
  const [active, inactive] = await Promise.all([
    prisma.installation.count({ where: { organizationId, deletedAt: null, active: true } }),
    prisma.installation.count({ where: { organizationId, deletedAt: null, active: false } }),
  ]);
  return { active, inactive };
}

export async function getInstallation(installationId: string) {
  const organizationId = await requireOrgId();
  return prisma.installation.findFirst({
    where: { id: installationId, organizationId, deletedAt: null },
    include: {
      pieces: { where: { deletedAt: null }, orderBy: { name: "asc" } },
      softwareItems: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      photosEnsemble: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          points: {
            where: { deletedAt: null },
            orderBy: { num: "asc" },
            include: {
              targetPiece: { select: { id: true, name: true, deletedAt: true } },
              entries: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, include: entryInclude },
            },
          },
        },
      },
    },
  });
}

export async function getPiece(pieceId: string) {
  const organizationId = await requireOrgId();
  return prisma.piece.findFirst({
    where: { id: pieceId, deletedAt: null, installation: { organizationId } },
    include: {
      installation: true,
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
    where: { id: softwareItemId, deletedAt: null, installation: { organizationId } },
    include: {
      installation: true,
      entries: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: entryInclude },
    },
  });
}

export async function listJournal() {
  const organizationId = await requireOrgId();
  return prisma.entry.findMany({
    where: { organizationId, type: "journal", deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { ...entryInclude, linkedPiece: { include: { installation: true } } },
  });
}

/** Liste plate des pièces (pour le sélecteur de lien du journal). */
export async function listPiecesForPicker() {
  const organizationId = await requireOrgId();
  const pieces = await prisma.piece.findMany({
    where: { deletedAt: null, installation: { organizationId } },
    orderBy: [{ installation: { name: "asc" } }, { name: "asc" }],
    include: { installation: { select: { name: true } } },
  });
  return pieces.map((p) => ({ id: p.id, label: `${p.installation.name} — ${p.name}` }));
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
  const [installations, pieces, points, softwareItems, photosEnsemble, entries] = await Promise.all([
    prisma.installation.findMany({ where: { organizationId, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
    prisma.piece.findMany({
      where: { deletedAt: { not: null }, installation: { organizationId } },
      orderBy: { deletedAt: "desc" },
      include: { installation: true },
    }),
    prisma.point.findMany({
      where: {
        deletedAt: { not: null },
        OR: [{ piece: { installation: { organizationId } } }, { photoEnsemble: { installation: { organizationId } } }],
      },
      orderBy: { deletedAt: "desc" },
      include: { piece: true, photoEnsemble: true },
    }),
    prisma.softwareItem.findMany({
      where: { deletedAt: { not: null }, installation: { organizationId } },
      orderBy: { deletedAt: "desc" },
      include: { installation: true },
    }),
    prisma.photoEnsemble.findMany({
      where: { deletedAt: { not: null }, installation: { organizationId } },
      orderBy: { deletedAt: "desc" },
      include: { installation: true },
    }),
    prisma.entry.findMany({
      where: { organizationId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: entryInclude,
    }),
  ]);
  return { installations, pieces, points, softwareItems, photosEnsemble, entries };
}

/** Résolution d'une entrée partagée par token (usage page publique, hors scope org). */
export async function getSharedEntry(shareToken: string) {
  return prisma.entry.findFirst({
    where: { shareToken, shareable: true, deletedAt: null },
    include: {
      ...entryInclude,
      point: {
        include: {
          piece: { include: { installation: true } },
          photoEnsemble: { include: { installation: true } },
        },
      },
      softwareItem: { include: { installation: true } },
      linkedPiece: { include: { installation: true } },
    },
  });
}
