import { route, readJson, ok } from "@/lib/api";
import { createMachine } from "@/lib/mutations";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const body = await readJson(req);
  const machine = await createMachine(body);
  return ok(machine, { status: 201 });
});
