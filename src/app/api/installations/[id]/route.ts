import { route, readJson, ok } from "@/lib/api";
import { updateInstallation, softDelete } from "@/lib/mutations";

export const runtime = "nodejs";

export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updateInstallation(id, body));
});

export const DELETE = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await softDelete("installation", id));
});
