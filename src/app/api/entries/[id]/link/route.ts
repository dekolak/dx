import { route, readJson, ok } from "@/lib/api";
import { relinkJournalEntry } from "@/lib/mutations";

export const runtime = "nodejs";

// Change (ou retire) le lien d'une note de journal (pièce / installation / logiciel).
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await relinkJournalEntry(id, body));
});
