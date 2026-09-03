import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public health check used by Railway. Verifies the app and database respond without exposing configuration. */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok", latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unavailable", timestamp: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
