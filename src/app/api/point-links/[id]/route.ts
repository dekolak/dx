import { route, ok } from "@/lib/api";
import { deletePointLink } from "@/lib/mutations";

export const runtime = "nodejs";

export const DELETE = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await deletePointLink(id));
});
