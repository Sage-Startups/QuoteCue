import type { Prisma } from "@/lib/db";
import { enumParam } from "../_lib/admin";

export const WEBHOOK_STATUSES = ["RECEIVED", "PROCESSED", "FAILED", "IGNORED"] as const;

export function buildWebhookWhere(params: { q?: string; status?: string }): Prisma.StripeWebhookEventWhereInput {
  const where: Prisma.StripeWebhookEventWhereInput = {};
  if (params.q) where.OR = [{ type: { contains: params.q, mode: "insensitive" } }, { stripeEventId: { contains: params.q, mode: "insensitive" } }, { error: { contains: params.q, mode: "insensitive" } }];
  const status = enumParam(params.status, WEBHOOK_STATUSES);
  if (status) where.status = status;
  return where;
}
