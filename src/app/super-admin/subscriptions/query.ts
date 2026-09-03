import type { Prisma } from "@/lib/db";
import { enumParam, excludeDemoFrom } from "../_lib/admin";

export const SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "UNPAID", "INCOMPLETE", "INCOMPLETE_EXPIRED", "PAUSED", "COMPLIMENTARY"] as const;
export const PLAN_KEYS = ["FREE", "STARTER", "PRO", "CREDIT_PACK_5"] as const;

export function buildSubscriptionWhere(params: { q?: string; status?: string; plan?: string; excludeDemo?: string }): Prisma.SubscriptionWhereInput {
  const where: Prisma.SubscriptionWhereInput = { workspace: { deletedAt: null, ...(excludeDemoFrom(params.excludeDemo) ? { isDemo: false } : {}) } };
  if (params.q) {
    where.OR = [{ workspace: { name: { contains: params.q, mode: "insensitive" } } }, { workspace: { owner: { email: { contains: params.q, mode: "insensitive" } } } }, { stripeCustomerId: { contains: params.q, mode: "insensitive" } }, { stripeSubscriptionId: { contains: params.q, mode: "insensitive" } }];
  }
  const status = enumParam(params.status, SUBSCRIPTION_STATUSES);
  if (status) where.status = status;
  const plan = enumParam(params.plan, PLAN_KEYS);
  if (plan) where.plan = { key: plan };
  return where;
}
