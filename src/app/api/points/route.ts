import { route, readJson, ok } from "@/lib/api";
import { createPoint } from "@/lib/mutations";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const body = await readJson(req);
  return ok(await createPoint(body), { status: 201 });
});
