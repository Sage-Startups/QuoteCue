import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { csvResponse, superAdminForRoute } from "../../_lib/admin";
import { buildQuoteWhere } from "../query";

export const dynamic = "force-dynamic";

/** Metadata-only CSV export (no enquiry text, notes or wording). */
export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const where = buildQuoteWhere({ q: sp.get("q") ?? undefined, status: sp.get("status") ?? undefined, excludeDemo: sp.get("excludeDemo") ?? undefined });
  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { id: true, number: true, title: true, status: true, currency: true, totalMinor: true, createdAt: true, sentAt: true, firstViewedAt: true, acceptedAt: true, declinedAt: true, expiresAt: true, viewCount: true, workspace: { select: { id: true, name: true, slug: true } } },
  });
  const rows = quotes.map((q) => ({
    id: q.id,
    number: q.number,
    title: q.title,
    status: q.status,
    workspace_id: q.workspace.id,
    workspace: q.workspace.name,
    workspace_slug: q.workspace.slug,
    currency: q.currency,
    total_minor: q.totalMinor,
    views: q.viewCount,
    created_at: q.createdAt.toISOString(),
    sent_at: q.sentAt?.toISOString() ?? "",
    first_viewed_at: q.firstViewedAt?.toISOString() ?? "",
    accepted_at: q.acceptedAt?.toISOString() ?? "",
    declined_at: q.declinedAt?.toISOString() ?? "",
    expires_at: q.expiresAt?.toISOString() ?? "",
  }));
  return csvResponse(toCsv(rows), "quotes");
}
