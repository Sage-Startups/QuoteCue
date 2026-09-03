import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { csvResponse, maskId, superAdminForRoute } from "../../_lib/admin";
import { buildSubscriptionWhere } from "../query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const where = buildSubscriptionWhere({ q: sp.get("q") ?? undefined, status: sp.get("status") ?? undefined, plan: sp.get("plan") ?? undefined, excludeDemo: sp.get("excludeDemo") ?? undefined });
  const subs = await prisma.subscription.findMany({ where, orderBy: { updatedAt: "desc" }, take: 5000, include: { plan: { select: { key: true } }, workspace: { select: { name: true, slug: true, owner: { select: { email: true } } } } } });
  const rows = subs.map((s) => ({
    workspace_id: s.workspaceId,
    workspace: s.workspace.name,
    slug: s.workspace.slug,
    owner_email: s.workspace.owner.email,
    plan: s.plan.key,
    status: s.status,
    interval: s.interval,
    period_start: s.currentPeriodStart.toISOString(),
    period_end: s.currentPeriodEnd.toISOString(),
    cancel_at_period_end: s.cancelAtPeriodEnd ? "yes" : "no",
    canceled_at: s.canceledAt?.toISOString() ?? "",
    complimentary_until: s.complimentaryUntil?.toISOString() ?? "",
    stripe_customer: maskId(s.stripeCustomerId),
    stripe_subscription: maskId(s.stripeSubscriptionId),
    last_synced_at: s.lastSyncedAt?.toISOString() ?? "",
    created_at: s.createdAt.toISOString(),
  }));
  return csvResponse(toCsv(rows), "subscriptions");
}
