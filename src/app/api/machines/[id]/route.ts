import { route, readJson, ok } from "@/lib/api";
import { updateMachine, softDelete } from "@/lib/mutations";

export const runtime = "nodejs";

export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updateMachine(id, body));
});

export const DELETE = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await softDelete("machine", id));
});
