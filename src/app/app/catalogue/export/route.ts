import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth";
import { exportCatalogueCsv } from "@/lib/services/catalogue";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const csv = await exportCatalogueCsv(ctx.workspace.id);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="service-catalogue-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
