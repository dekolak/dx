import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Middleware edge : vérifie le cookie de session (JWT) pour toutes les routes
// hors login, partage public et assets. On ne fait ici QUE la vérification de
// signature (jose est edge-compatible) ; la logique métier reste côté route.

const COOKIE_NAME = "dx_session";

const PUBLIC_PREFIXES = ["/login", "/s/", "/api/auth/", "/api/health", "/manifest.webmanifest", "/sw.js", "/icons/"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return false;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (await hasValidSession(req)) return NextResponse.next();

  // API -> 401 JSON ; pages -> redirection vers /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // On exclut les fichiers statiques Next et les assets à la racine.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
