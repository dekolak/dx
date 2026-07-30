import { route, readJson, ok } from "@/lib/api";
import { softDelete, updatePhotoEnsemble } from "@/lib/mutations";

export const runtime = "nodejs";

export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updatePhotoEnsemble(id, body));
});

export const DELETE = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await softDelete("photoEnsemble", id));
});
