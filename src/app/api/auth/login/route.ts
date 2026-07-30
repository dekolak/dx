import { authenticate, createSessionCookie } from "@/lib/auth";
import { route, readJson, ok, BadRequestError } from "@/lib/api";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const { email, password } = await readJson<{ email?: string; password?: string }>(req);
  if (!email || !password) throw new BadRequestError("Email et mot de passe requis");
  const session = await authenticate(email, password);
  if (!session) {
    return ok({ error: "Identifiants invalides" }, { status: 401 });
  }
  await createSessionCookie(session);
  return ok({ ok: true });
});
