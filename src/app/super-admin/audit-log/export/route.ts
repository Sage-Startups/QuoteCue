import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { csvResponse, superAdminForRoute } from "../../_lib/admin";
import { buildAuditWhere } from "../query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const where = buildAuditWhere({ action: sp.get("action") ?? undefined, actor: sp.get("actor") ?? undefined, targetType: sp.get("targetType") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const entries = await prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000 });
  const rows = entries.map((a) => ({ id: a.id, created_at: a.createdAt.toISOString(), actor_user_id: a.actorUserId ?? "", actor_email: a.actorEmail ?? "", action: a.action, target_type: a.targetType, target_id: a.targetId ?? "", reason: a.reason ?? "", previous_value: a.previousValue === null ? "" : JSON.stringify(a.previousValue), new_value: a.newValue === null ? "" : JSON.stringify(a.newValue) }));
  return csvResponse(toCsv(rows), "audit-log");
}
