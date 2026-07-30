import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/auth";
import { BadRequestError, NotFoundError } from "@/lib/api";
import { deleteObjectByUrl } from "@/lib/storage";

// Couche d'écriture. Chaque fonction (re)vérifie que la ressource appartient à
// l'org courante AVANT de muter. Aucun handler ne doit écrire hors de ces
// helpers, pour ne jamais casser l'isolation multi-tenant.

// --- helpers d'appartenance -------------------------------------------------

async function assertMachine(orgId: string, machineId: string) {
  const m = await prisma.machine.findFirst({ where: { id: machineId, organizationId: orgId } });
  if (!m) throw new NotFoundError("Machine introuvable");
  return m;
}

async function assertPiece(orgId: string, pieceId: string) {
  const p = await prisma.piece.findFirst({ where: { id: pieceId, machine: { organizationId: orgId } } });
  if (!p) throw new NotFoundError("Pièce introuvable");
  return p;
}

async function assertPoint(orgId: string, pointId: string) {
  const p = await prisma.point.findFirst({ where: { id: pointId, piece: { machine: { organizationId: orgId } } } });
  if (!p) throw new NotFoundError("Point introuvable");
  return p;
}

async function assertSoftware(orgId: string, softwareItemId: string) {
  const s = await prisma.softwareItem.findFirst({
    where: { id: softwareItemId, machine: { organizationId: orgId } },
  });
  if (!s) throw new NotFoundError("Software introuvable");
  return s;
}

async function assertEntry(orgId: string, entryId: string) {
  const e = await prisma.entry.findFirst({ where: { id: entryId, organizationId: orgId } });
  if (!e) throw new NotFoundError("Entrée introuvable");
  return e;
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestError(`Champ « ${field} » requis`);
  return value.trim();
}

// --- Machines ---------------------------------------------------------------

export async function createMachine(input: { name?: unknown; category?: unknown }) {
  const organizationId = await requireOrgId();
  return prisma.machine.create({
    data: {
      organizationId,
      name: nonEmpty(input.name, "name"),
      category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null,
    },
  });
}

export async function updateMachine(id: string, input: { name?: unknown; category?: unknown }) {
  const organizationId = await requireOrgId();
  await assertMachine(organizationId, id);
  return prisma.machine.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: nonEmpty(input.name, "name") } : {}),
      ...(input.category !== undefined
        ? { category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null }
        : {}),
    },
  });
}

// --- Pièces -----------------------------------------------------------------

export async function createPiece(input: { machineId?: unknown; name?: unknown; category?: unknown; photoUrl?: unknown }) {
  const organizationId = await requireOrgId();
  const machineId = nonEmpty(input.machineId, "machineId");
  await assertMachine(organizationId, machineId);
  return prisma.piece.create({
    data: {
      machineId,
      name: nonEmpty(input.name, "name"),
      category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null,
      photoUrl: typeof input.photoUrl === "string" && input.photoUrl.trim() ? input.photoUrl.trim() : null,
    },
  });
}

export async function updatePiece(id: string, input: { name?: unknown; category?: unknown; photoUrl?: unknown }) {
  const organizationId = await requireOrgId();
  await assertPiece(organizationId, id);
  return prisma.piece.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: nonEmpty(input.name, "name") } : {}),
      ...(input.category !== undefined
        ? { category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null }
        : {}),
      ...(input.photoUrl !== undefined
        ? { photoUrl: typeof input.photoUrl === "string" && input.photoUrl.trim() ? input.photoUrl.trim() : null }
        : {}),
    },
  });
}

// --- Points -----------------------------------------------------------------

export async function createPoint(input: { pieceId?: unknown; x?: unknown; y?: unknown }) {
  const organizationId = await requireOrgId();
  const pieceId = nonEmpty(input.pieceId, "pieceId");
  await assertPiece(organizationId, pieceId);
  // Numérotation continue par pièce (points soft-deleted inclus pour éviter les collisions visuelles).
  const max = await prisma.point.aggregate({ where: { pieceId }, _max: { num: true } });
  const num = (max._max.num ?? 0) + 1;
  const x = typeof input.x === "number" ? input.x : null;
  const y = typeof input.y === "number" ? input.y : null;
  return prisma.point.create({ data: { pieceId, num, x, y } });
}

export async function updatePoint(id: string, input: { x?: unknown; y?: unknown; num?: unknown }) {
  const organizationId = await requireOrgId();
  await assertPoint(organizationId, id);
  return prisma.point.update({
    where: { id },
    data: {
      ...(input.x !== undefined ? { x: typeof input.x === "number" ? input.x : null } : {}),
      ...(input.y !== undefined ? { y: typeof input.y === "number" ? input.y : null } : {}),
      ...(typeof input.num === "number" ? { num: input.num } : {}),
    },
  });
}

// --- Software ---------------------------------------------------------------

export async function createSoftwareItem(input: { machineId?: unknown; name?: unknown }) {
  const organizationId = await requireOrgId();
  const machineId = nonEmpty(input.machineId, "machineId");
  await assertMachine(organizationId, machineId);
  return prisma.softwareItem.create({ data: { machineId, name: nonEmpty(input.name, "name") } });
}

// --- Entrées (le bloc central) ----------------------------------------------

type MediaInput = { url: string; type: "photo" | "video" };

function normalizeMedia(raw: unknown): MediaInput[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new BadRequestError("media doit être un tableau");
  return raw.map((m) => {
    const url = nonEmpty((m as Record<string, unknown>)?.url, "media.url");
    const type = (m as Record<string, unknown>)?.type === "video" ? "video" : "photo";
    return { url, type: type as "photo" | "video" };
  });
}

/**
 * Crée une nouvelle entrée EMPILÉE (jamais d'écrasement de l'historique).
 * Selon `type`, rattache à un point, un software, ou reste journal libre.
 */
export async function createEntry(input: {
  type?: unknown;
  text?: unknown;
  pointId?: unknown;
  softwareItemId?: unknown;
  linkedPieceId?: unknown;
  media?: unknown;
}) {
  const organizationId = await requireOrgId();
  const type = input.type;
  if (type !== "point" && type !== "software" && type !== "journal") {
    throw new BadRequestError("type invalide (point | software | journal)");
  }
  const media = normalizeMedia(input.media);
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text && media.length === 0) throw new BadRequestError("Une entrée doit avoir du texte ou un média");

  const data: Record<string, unknown> = { organizationId, type, text };

  if (type === "point") {
    const pointId = nonEmpty(input.pointId, "pointId");
    await assertPoint(organizationId, pointId);
    data.pointId = pointId;
  } else if (type === "software") {
    const softwareItemId = nonEmpty(input.softwareItemId, "softwareItemId");
    await assertSoftware(organizationId, softwareItemId);
    data.softwareItemId = softwareItemId;
  } else if (type === "journal") {
    if (typeof input.linkedPieceId === "string" && input.linkedPieceId.trim()) {
      await assertPiece(organizationId, input.linkedPieceId.trim());
      data.linkedPieceId = input.linkedPieceId.trim();
    }
  }

  return prisma.entry.create({
    data: {
      ...(data as { organizationId: string; type: string; text: string }),
      media: { create: media.map((m) => ({ url: m.url, type: m.type })) },
    },
    include: { media: true },
  });
}

/** « Corriger » : édition en place d'une entrée existante (coquille). */
export async function correctEntry(id: string, input: { text?: unknown; media?: unknown }) {
  const organizationId = await requireOrgId();
  await assertEntry(organizationId, id);
  const media = input.media !== undefined ? normalizeMedia(input.media) : null;
  return prisma.entry.update({
    where: { id },
    data: {
      ...(input.text !== undefined ? { text: typeof input.text === "string" ? input.text.trim() : "" } : {}),
      // Remplacement complet des médias si fourni (soft-delete des anciens, ajout des nouveaux).
      ...(media
        ? {
            media: {
              updateMany: { where: { deletedAt: null }, data: { deletedAt: new Date() } },
              create: media.map((m) => ({ url: m.url, type: m.type })),
            },
          }
        : {}),
    },
    include: { media: { where: { deletedAt: null } } },
  });
}

/** Active/désactive le partage public d'une entrée (génère un token stable). */
export async function setEntryShareable(id: string, shareable: boolean) {
  const organizationId = await requireOrgId();
  const entry = await assertEntry(organizationId, id);
  if (shareable) {
    return prisma.entry.update({
      where: { id },
      data: { shareable: true, shareToken: entry.shareToken ?? randomUUID().replace(/-/g, "") },
    });
  }
  return prisma.entry.update({ where: { id }, data: { shareable: false } });
}

// --- Soft delete / restore / purge ------------------------------------------

type Kind = "machine" | "piece" | "point" | "software" | "entry";

const assertByKind: Record<Kind, (org: string, id: string) => Promise<unknown>> = {
  machine: assertMachine,
  piece: assertPiece,
  point: assertPoint,
  software: assertSoftware,
  entry: assertEntry,
};

// Délégué dynamique : tous ces modèles exposent `deletedAt` + update/delete.
// Le typage précis n'apporte rien ici, on type le délégué en `any` volontairement.
type SoftDeletable = {
  update: (args: { where: { id: string }; data: { deletedAt: Date | null } }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

const modelByKind: Record<Kind, () => SoftDeletable> = {
  machine: () => prisma.machine as unknown as SoftDeletable,
  piece: () => prisma.piece as unknown as SoftDeletable,
  point: () => prisma.point as unknown as SoftDeletable,
  software: () => prisma.softwareItem as unknown as SoftDeletable,
  entry: () => prisma.entry as unknown as SoftDeletable,
};

export async function softDelete(kind: Kind, id: string) {
  const organizationId = await requireOrgId();
  await assertByKind[kind](organizationId, id);
  return modelByKind[kind]().update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function restore(kind: Kind, id: string) {
  const organizationId = await requireOrgId();
  await assertByKind[kind](organizationId, id);
  return modelByKind[kind]().update({ where: { id }, data: { deletedAt: null } });
}

/** Purge définitive. Supprime aussi les objets média du stockage OVH. */
export async function purge(kind: Kind, id: string) {
  const organizationId = await requireOrgId();
  await assertByKind[kind](organizationId, id);

  // Récupère toutes les URLs média impactées pour nettoyer le stockage.
  const mediaWhere =
    kind === "entry"
      ? { entryId: id }
      : kind === "point"
        ? { entry: { pointId: id } }
        : kind === "software"
          ? { entry: { softwareItemId: id } }
          : kind === "piece"
            ? { entry: { OR: [{ point: { pieceId: id } }, { linkedPieceId: id }] } }
            : { entry: { point: { piece: { machineId: id } } } }; // machine (best-effort)

  const media = await prisma.media.findMany({ where: mediaWhere, select: { url: true } });
  await Promise.allSettled(media.map((m) => deleteObjectByUrl(m.url)));

  // Les cascades Prisma (onDelete: Cascade) nettoient les enfants.
  return modelByKind[kind]().delete({ where: { id } });
}
