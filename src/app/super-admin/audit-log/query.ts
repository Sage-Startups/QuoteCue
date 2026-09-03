import type { Prisma } from "@/lib/db";
import { parseDateInput, endOfDayUtc } from "@/lib/utils/dates";

export const ROLLBACK_ACTIONS = ["setting.update", "marketing.update", "flag.update"] as const;

export function buildAuditWhere(params: { action?: string; actor?: string; targetType?: string; from?: string; to?: string }): Prisma.AdminAuditLogWhereInput {
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (params.action) where.action = { contains: params.action, mode: "insensitive" };
  if (params.actor) where.actorEmail = { contains: params.actor, mode: "insensitive" };
  if (params.targetType) where.targetType = params.targetType;
  const from = parseDateInput(params.from);
  const to = parseDateInput(params.to);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: endOfDayUtc(to) } : {}) };
  return where;
}
