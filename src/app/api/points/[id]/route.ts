import { route, readJson, ok } from "@/lib/api";
import { updatePoint, softDelete } from "@/lib/mutations";

export const runtime = "nodejs";

export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updatePoint(id, body));
});

export const DELETE = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await softDelete("point", id));
});
