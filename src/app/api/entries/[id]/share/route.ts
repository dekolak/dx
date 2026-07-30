import { route, readJson, ok } from "@/lib/api";
import { setEntryShareable } from "@/lib/mutations";

export const runtime = "nodejs";

// Active/désactive le partage public. Retourne l'entrée avec son shareToken.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const { shareable } = await readJson<{ shareable?: boolean }>(req);
  return ok(await setEntryShareable(id, Boolean(shareable)));
});
