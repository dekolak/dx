import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Auth volontairement simple : email + mot de passe -> cookie de session signé
// (JWT via `jose`). La session porte `organizationId` pour que TOUTE requête
// domaine soit scopée org. Passer en multi-org/multi-user plus tard = émettre
// des sessions pour d'autres utilisateurs, sans toucher à la logique de scope.

const COOKIE_NAME = "dx_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export type Session = {
  userId: string;
  organizationId: string;
  email: string;
};

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET manquant dans l'environnement.");
  return new TextEncoder().encode(s);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Vérifie les identifiants et retourne la session (ou null). */
export async function authenticate(email: string, password: string): Promise<Session | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return { userId: user.id, organizationId: user.organizationId, email: user.email };
}

export async function createSessionCookie(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Retourne la session courante ou null (ne lève pas). */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.userId || !payload.organizationId) return null;
    return {
      userId: String(payload.userId),
      organizationId: String(payload.organizationId),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

/** Impose une session valide ; lève si absente (à utiliser dans les routes protégées). */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Raccourci : l'organizationId courant, pour scoper les requêtes. */
export async function requireOrgId(): Promise<string> {
  return (await requireSession()).organizationId;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Non authentifié");
    this.name = "UnauthorizedError";
  }
}
