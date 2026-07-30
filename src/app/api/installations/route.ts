import { route, readJson, ok } from "@/lib/api";
import { createInstallation } from "@/lib/mutations";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const body = await readJson(req);
  const installation = await createInstallation(body);
  return ok(installation, { status: 201 });
});
