import { route, ok, BadRequestError } from "@/lib/api";
import { restore, purge } from "@/lib/mutations";

export const runtime = "nodejs";

const KINDS = ["installation", "piece", "point", "software", "entry"] as const;
type Kind = (typeof KINDS)[number];

function parseKind(raw: string): Kind {
  if ((KINDS as readonly string[]).includes(raw)) return raw as Kind;
  throw new BadRequestError("kind invalide");
}

// POST = restaurer (deletedAt -> null)
export const POST = route(async (_req, ctx) => {
  const { kind, id } = await ctx.params;
  return ok(await restore(parseKind(kind), id));
});

// DELETE = purge définitive (+ suppression des médias sur OVH)
export const DELETE = route(async (_req, ctx) => {
  const { kind, id } = await ctx.params;
  await purge(parseKind(kind), id);
  return ok({ ok: true });
});
