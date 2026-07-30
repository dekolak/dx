import { route, readJson, ok } from "@/lib/api";
import { correctEntry, softDelete } from "@/lib/mutations";

export const runtime = "nodejs";

// PATCH = « Corriger » (édition en place d'une coquille, pas de nouvelle entrée).
export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await correctEntry(id, body));
});

export const DELETE = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await softDelete("entry", id));
});
