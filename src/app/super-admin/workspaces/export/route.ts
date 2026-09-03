import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { csvResponse, superAdminForRoute } from "../../_lib/admin";
import { buildWorkspaceWhere } from "../query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const where = buildWorkspaceWhere({ q: sp.get("q") ?? undefined, status: sp.get("status") ?? undefined, excludeDemo: sp.get("excludeDemo") ?? undefined });
  const workspaces = await prisma.workspace.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { id: true, name: true, slug: true, status: true, isDemo: true, aiCreditBalance: true, createdAt: true, deletionRequestedAt: true, owner: { select: { email: true } }, subscription: { select: { status: true, interval: true, currentPeriodEnd: true, plan: { select: { key: true } } } }, _count: { select: { members: true, quotes: true } } },
  });
  const rows = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    owner_email: w.owner.email,
    status: w.status,
    demo: w.isDemo ? "yes" : "no",
    plan: w.subscription?.plan.key ?? "",
    subscription_status: w.subscription?.status ?? "",
    interval: w.subscription?.interval ?? "",
    period_end: w.subscription?.currentPeriodEnd?.toISOString() ?? "",
    members: w._count.members,
    quotes: w._count.quotes,
    credit_balance: w.aiCreditBalance,
    deletion_requested_at: w.deletionRequestedAt?.toISOString() ?? "",
    created_at: w.createdAt.toISOString(),
  }));
  return csvResponse(toCsv(rows), "workspaces");
}
