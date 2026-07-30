import { route, readJson, ok } from "@/lib/api";
import { createEntry } from "@/lib/mutations";

export const runtime = "nodejs";

// Crée une nouvelle entrée EMPILÉE (« Ajouter une info »).
export const POST = route(async (req) => {
  const body = await readJson(req);
  return ok(await createEntry(body), { status: 201 });
});
