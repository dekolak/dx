import { destroySessionCookie } from "@/lib/auth";
import { route, ok } from "@/lib/api";

export const runtime = "nodejs";

export const POST = route(async () => {
  await destroySessionCookie();
  return ok({ ok: true });
});
