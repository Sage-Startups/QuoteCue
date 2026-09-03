import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { exportUserData } from "@/lib/services/account";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await enforceRateLimit("export", session.user.id);
  } catch {
    return NextResponse.json({ error: "Too many export requests. Try again later." }, { status: 429 });
  }
  const data = await exportUserData(session.user.id);
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="quotecue-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}
