import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContext } from "@/lib/auth";
import { assertFeature } from "@/lib/billing/entitlements";
import { listQuotes } from "@/lib/services/quotes";
import { toCsv } from "@/lib/utils/csv";
import { customerDisplayName } from "@/lib/services/customers";
import type { QuoteStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertFeature(ctx.workspace.id, "CSV_EXPORT");
  } catch {
    return NextResponse.json({ error: "CSV export is not included in your plan" }, { status: 402 });
  }
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") as QuoteStatus | "ALL" | "OPEN" | null;
  const result = await listQuotes(ctx.workspace.id, { search: sp.get("q") ?? undefined, status: status ?? "ALL", customerId: sp.get("customerId") ?? undefined, from: sp.get("from"), to: sp.get("to"), pageSize: 100, page: 1, includeArchived: true });
  const rows = result.items.map((q) => ({
    number: q.number,
    title: q.title,
    status: q.status,
    customer: q.customer ? customerDisplayName(q.customer) : "",
    total: (q.totalMinor / 100).toFixed(2),
    currency: q.currency,
    created_at: q.createdAt.toISOString(),
    sent_at: q.sentAt?.toISOString() ?? "",
    viewed_at: q.firstViewedAt?.toISOString() ?? "",
    accepted_at: q.acceptedAt?.toISOString() ?? "",
    declined_at: q.declinedAt?.toISOString() ?? "",
    expires_at: q.expiresAt?.toISOString() ?? "",
  }));
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="quotes-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
