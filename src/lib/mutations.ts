import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/auth";
import { BadRequestError, NotFoundError } from "@/lib/api";
import { deleteMediaByUrl } from "@/lib/storage";

// Couche d'écriture. Chaque fonction (re)vérifie que la ressource appartient à
// l'org courante AVANT de muter. Aucun handler ne doit écrire hors de ces
// helpers, pour ne jamais casser l'isolation multi-tenant.

// --- helpers d'appartenance -------------------------------------------------

async function assertInstallation(orgId: string, installationId: string) {
  const m = await prisma.installation.findFirst({ where: { id: installationId, organizationId: orgId } });
  if (!m) throw new NotFoundError("Installation introuvable");
  return m;
}

async function assertPiece(orgId: string, pieceId: string) {
  const p = await prisma.piece.findFirst({ where: { id: pieceId, installation: { organizationId: orgId } } });
  if (!p) throw new NotFoundError("Pièce introuvable");
  return p;
}

async function assertPoint(orgId: string, pointId: string) {
  // Un point appartient soit à une Pièce, soit à une photo d'ensemble.
  const p = await prisma.point.findFirst({
    where: {
      id: pointId,
      OR: [
        { piece: { installation: { organizationId: orgId } } },
        { photoEnsemble: { installation: { organizationId: orgId } } },
      ],
    },
  });
  if (!p) throw new NotFoundError("Point introuvable");
  return p;
}

async function assertPhotoEnsemble(orgId: string, photoEnsembleId: string) {
  const pe = await prisma.photoEnsemble.findFirst({
    where: { id: photoEnsembleId, installation: { organizationId: orgId } },
  });
  if (!pe) throw new NotFoundError("Photo d'ensemble introuvable");
  return pe;
}

async function assertSoftware(orgId: string, softwareItemId: string) {
  const s = await prisma.softwareItem.findFirst({
    where: { id: softwareItemId, installation: { organizationId: orgId } },
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

// --- Installations ----------------------------------------------------------

// Petit helper : chaîne optionnelle nettoyée (null si vide).
function optStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

type InstallationInput = {
  name?: unknown;
  category?: unknown;
  brand?: unknown;
  model?: unknown;
  machineRef?: unknown;
  clientRef?: unknown;
  active?: unknown;
};

export async function createInstallation(input: InstallationInput) {
  const organizationId = await requireOrgId();
  return prisma.installation.create({
    data: {
      organizationId,
      name: nonEmpty(input.name, "name"),
      category: optStr(input.category),
      brand: optStr(input.brand),
      model: optStr(input.model),
      machineRef: optStr(input.machineRef),
      clientRef: optStr(input.clientRef),
      ...(typeof input.active === "boolean" ? { active: input.active } : {}),
    },
  });
}

export async function updateInstallation(id: string, input: InstallationInput) {
  const organizationId = await requireOrgId();
  await assertInstallation(organizationId, id);
  return prisma.installation.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: nonEmpty(input.name, "name") } : {}),
      ...(input.category !== undefined ? { category: optStr(input.category) } : {}),
      ...(input.brand !== undefined ? { brand: optStr(input.brand) } : {}),
      ...(input.model !== undefined ? { model: optStr(input.model) } : {}),
      ...(input.machineRef !== undefined ? { machineRef: optStr(input.machineRef) } : {}),
      ...(input.clientRef !== undefined ? { clientRef: optStr(input.clientRef) } : {}),
      ...(typeof input.active === "boolean" ? { active: input.active } : {}),
    },
  });
}

// --- Pièces -----------------------------------------------------------------

export async function createPiece(input: { installationId?: unknown; name?: unknown; category?: unknown; photoUrl?: unknown }) {
  const organizationId = await requireOrgId();
  const installationId = nonEmpty(input.installationId, "installationId");
  await assertInstallation(organizationId, installationId);
  return prisma.piece.create({
    data: {
      installationId,
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

// Un point a EXACTEMENT un parent : une Pièce (pieceId) ou une photo d'ensemble
// (photoEnsembleId). Sur une photo d'ensemble, il peut être un raccourci vers
// une Pièce (targetPieceId).
export async function createPoint(input: {
  pieceId?: unknown;
  photoEnsembleId?: unknown;
  targetPieceId?: unknown;
  x?: unknown;
  y?: unknown;
  icon?: unknown;
}) {
  const organizationId = await requireOrgId();
  const hasPiece = typeof input.pieceId === "string" && input.pieceId.trim();
  const hasOverview = typeof input.photoEnsembleId === "string" && input.photoEnsembleId.trim();
  if (hasPiece === hasOverview) {
    throw new BadRequestError("Fournir exactement un parent (pieceId OU photoEnsembleId)");
  }

  const x = typeof input.x === "number" ? input.x : null;
  const y = typeof input.y === "number" ? input.y : null;
  const icon = normalizeIcon(input.icon);

  if (hasPiece) {
    const pieceId = String(input.pieceId).trim();
    await assertPiece(organizationId, pieceId);
    const max = await prisma.point.aggregate({ where: { pieceId }, _max: { num: true } });
    return prisma.point.create({ data: { pieceId, num: (max._max.num ?? 0) + 1, x, y, icon } });
  }

  // Point sur une photo d'ensemble.
  const photoEnsembleId = String(input.photoEnsembleId).trim();
  await assertPhotoEnsemble(organizationId, photoEnsembleId);
  let targetPieceId: string | null = null;
  if (typeof input.targetPieceId === "string" && input.targetPieceId.trim()) {
    targetPieceId = input.targetPieceId.trim();
    await assertPiece(organizationId, targetPieceId); // le raccourci pointe vers une pièce de l'org
  }
  const max = await prisma.point.aggregate({ where: { photoEnsembleId }, _max: { num: true } });
  return prisma.point.create({ data: { photoEnsembleId, targetPieceId, num: (max._max.num ?? 0) + 1, x, y, icon } });
}

// Normalise une icône : garde le PREMIER graphème (un emoji, même composé de
// plusieurs code points comme ⚠️ ou 👨‍🔧), ou null pour l'effacer.
function normalizeIcon(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const first = seg.segment(s)[Symbol.iterator]().next().value as { segment: string } | undefined;
    return first ? first.segment.slice(0, 16) : null;
  } catch {
    return s.slice(0, 8);
  }
}

export async function updatePoint(id: string, input: { x?: unknown; y?: unknown; num?: unknown; icon?: unknown }) {
  const organizationId = await requireOrgId();
  await assertPoint(organizationId, id);
  return prisma.point.update({
    where: { id },
    data: {
      ...(input.x !== undefined ? { x: typeof input.x === "number" ? input.x : null } : {}),
      ...(input.y !== undefined ? { y: typeof input.y === "number" ? input.y : null } : {}),
      ...(typeof input.num === "number" ? { num: input.num } : {}),
      ...(input.icon !== undefined ? { icon: normalizeIcon(input.icon) } : {}),
    },
  });
}

// --- Software ---------------------------------------------------------------

export async function createSoftwareItem(input: { installationId?: unknown; name?: unknown }) {
  const organizationId = await requireOrgId();
  const installationId = nonEmpty(input.installationId, "installationId");
  await assertInstallation(organizationId, installationId);
  return prisma.softwareItem.create({ data: { installationId, name: nonEmpty(input.name, "name") } });
}

// --- Photos d'ensemble ------------------------------------------------------

export async function createPhotoEnsemble(input: { installationId?: unknown; url?: unknown; label?: unknown }) {
  const organizationId = await requireOrgId();
  const installationId = nonEmpty(input.installationId, "installationId");
  await assertInstallation(organizationId, installationId);
  const max = await prisma.photoEnsemble.aggregate({ where: { installationId }, _max: { sortOrder: true } });
  return prisma.photoEnsemble.create({
    data: {
      installationId,
      url: nonEmpty(input.url, "url"),
      label: optStr(input.label),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function updatePhotoEnsemble(id: string, input: { label?: unknown }) {
  const organizationId = await requireOrgId();
  await assertPhotoEnsemble(organizationId, id);
  return prisma.photoEnsemble.update({
    where: { id },
    data: { ...(input.label !== undefined ? { label: optStr(input.label) } : {}) },
  });
}

/** Réordonne les photos d'ensemble d'une installation (sortOrder = position). */
export async function reorderPhotosEnsemble(input: { installationId?: unknown; orderedIds?: unknown }) {
  const organizationId = await requireOrgId();
  const installationId = nonEmpty(input.installationId, "installationId");
  await assertInstallation(organizationId, installationId);
  if (!Array.isArray(input.orderedIds)) throw new BadRequestError("orderedIds doit être un tableau");

  // On ne réordonne QUE les photos qui appartiennent bien à cette installation.
  const owned = await prisma.photoEnsemble.findMany({
    where: { installationId, deletedAt: null },
    select: { id: true },
  });
  const valid = new Set(owned.map((p) => p.id));
  const ids = input.orderedIds.filter((x): x is string => typeof x === "string" && valid.has(x));

  await prisma.$transaction(ids.map((id, i) => prisma.photoEnsemble.update({ where: { id }, data: { sortOrder: i } })));
  return { ok: true, count: ids.length };
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

type Kind = "installation" | "piece" | "point" | "software" | "entry" | "photoEnsemble";

const assertByKind: Record<Kind, (org: string, id: string) => Promise<unknown>> = {
  installation: assertInstallation,
  piece: assertPiece,
  point: assertPoint,
  software: assertSoftware,
  entry: assertEntry,
  photoEnsemble: assertPhotoEnsemble,
};

// Délégué dynamique : tous ces modèles exposent `deletedAt` + update/delete.
// Le typage précis n'apporte rien ici, on type le délégué en `any` volontairement.
type SoftDeletable = {
  update: (args: { where: { id: string }; data: { deletedAt: Date | null } }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

const modelByKind: Record<Kind, () => SoftDeletable> = {
  installation: () => prisma.installation as unknown as SoftDeletable,
  piece: () => prisma.piece as unknown as SoftDeletable,
  point: () => prisma.point as unknown as SoftDeletable,
  software: () => prisma.softwareItem as unknown as SoftDeletable,
  entry: () => prisma.entry as unknown as SoftDeletable,
  photoEnsemble: () => prisma.photoEnsemble as unknown as SoftDeletable,
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
          : kind === "photoEnsemble"
            ? { entry: { point: { photoEnsembleId: id } } }
            : kind === "piece"
              ? { entry: { OR: [{ point: { pieceId: id } }, { linkedPieceId: id }] } }
              : { entry: { point: { piece: { installationId: id } } } }; // installation (best-effort)

  const media = await prisma.media.findMany({ where: mediaWhere, select: { url: true } });
  const extraFiles: string[] = [];
  if (kind === "photoEnsemble") {
    const pe = await prisma.photoEnsemble.findUnique({ where: { id }, select: { url: true } });
    if (pe?.url) extraFiles.push(pe.url); // le fichier de la photo d'ensemble lui-même
  }
  await Promise.allSettled([...media.map((m) => m.url), ...extraFiles].map((u) => deleteMediaByUrl(u)));

  // Les cascades Prisma (onDelete: Cascade) nettoient les enfants.
  return modelByKind[kind]().delete({ where: { id } });
}
