import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth";

// Petit wrapper pour les route handlers : uniformise le JSON et la gestion des
// erreurs (401 pour session absente, 400 pour validation, 500 sinon).

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Introuvable") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export function route(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }
      if (err instanceof BadRequestError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      console.error("API error:", err);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BadRequestError("Corps JSON invalide");
  }
}
