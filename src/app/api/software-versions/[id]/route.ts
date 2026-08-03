import { route, readJson, ok } from "@/lib/api";
import { deleteSoftwareVersion, setSoftwareVersionCurrent } from "@/lib/mutations";

export const runtime = "nodejs";

export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = (await readJson(req)) as { current?: unknown };
  return ok(await setSoftwareVersionCurrent(id, body.current === true));
});

export const DELETE = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await deleteSoftwareVersion(id));
});
