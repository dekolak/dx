import { NextResponse } from "next/server";

// Endpoint de santé (public) pour Coolify / monitoring.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
