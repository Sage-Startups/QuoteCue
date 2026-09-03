import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { csvResponse, superAdminForRoute } from "../../_lib/admin";
import { buildUserWhere } from "../query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const where = buildUserWhere({ q: sp.get("q") ?? undefined, role: sp.get("role") ?? undefined, verified: sp.get("verified") ?? undefined, suspended: sp.get("suspended") ?? undefined });
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { id: true, name: true, email: true, emailVerified: true, platformRole: true, suspendedAt: true, lastLoginAt: true, createdAt: true, onboardingCompletedAt: true, _count: { select: { memberships: true } } },
  });
  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.platformRole,
    verified: u.emailVerified ? "yes" : "no",
    suspended_at: u.suspendedAt?.toISOString() ?? "",
    onboarding_completed_at: u.onboardingCompletedAt?.toISOString() ?? "",
    workspaces: u._count.memberships,
    last_login_at: u.lastLoginAt?.toISOString() ?? "",
    created_at: u.createdAt.toISOString(),
  }));
  return csvResponse(toCsv(rows), "users");
}
