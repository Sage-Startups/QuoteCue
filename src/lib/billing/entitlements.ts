import type { BillingInterval, PlanKey, SubscriptionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { addMonths, addDays } from "@/lib/utils/dates";
import { ENTITLEMENT_KEYS, type EntitlementKey } from "./plans";
import { EntitlementError } from "@/lib/utils/result";

export interface WorkspaceEntitlements {
  planKey: PlanKey;
  planName: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  isTrial: boolean;
  /** True when the subscription grants paid entitlements (active, trialing, complimentary, or past-due within grace). */
  paidFeaturesActive: boolean;
  allowancePerPeriod: number;
  usedThisPeriod: number;
  allowanceRemaining: number;
  creditBalance: number;
  totalAvailable: number;
  maxMembers: number;
  memberCount: number;
  storageAllowanceMb: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  features: Record<EntitlementKey, boolean>;
  paymentFailureMessage: string | null;
}

const PAID_ACTIVE: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "COMPLIMENTARY", "PAST_DUE"];

export function currentPeriodFor(anchor: Date, interval: BillingInterval, now = new Date()): { start: Date; end: Date } {
  // Roll the anchor forward until it covers "now" so usage windows align with billing periods.
  let start = new Date(anchor.getTime());
  let end = interval === "YEAR" ? addMonths(start, 12) : addMonths(start, 1);
  let guard = 0;
  while (end.getTime() <= now.getTime() && guard < 240) {
    start = end;
    end = interval === "YEAR" ? addMonths(start, 12) : addMonths(start, 1);
    guard++;
  }
  return { start, end };
}

export async function ensureSubscription(workspaceId: string) {
  const existing = await prisma.subscription.findUnique({ where: { workspaceId }, include: { plan: { include: { entitlements: true } } } });
  if (existing) return existing;
  const free = await prisma.plan.findUnique({ where: { key: "FREE" } });
  if (!free) throw new Error("FREE plan is not seeded");
  const now = new Date();
  return prisma.subscription.create({
    data: {
      workspaceId,
      planId: free.id,
      status: "TRIALING",
      interval: "MONTH",
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, 30),
      trialEndsAt: addDays(now, 30),
    },
    include: { plan: { include: { entitlements: true } } },
  });
}

export async function getWorkspaceEntitlements(workspaceId: string, now = new Date()): Promise<WorkspaceEntitlements> {
  const subscription = await ensureSubscription(workspaceId);
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { aiCreditBalance: true, _count: { select: { members: true } } } });
  const plan = subscription.plan;
  const paidFeaturesActive =
    PAID_ACTIVE.includes(subscription.status) && !(subscription.status === "COMPLIMENTARY" && subscription.complimentaryUntil && subscription.complimentaryUntil < now);

  const { start, end } = subscription.stripeSubscriptionId
    ? { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd }
    : currentPeriodFor(subscription.currentPeriodStart, subscription.interval, now);

  const usage = await prisma.usageRecord.findUnique({
    where: { workspaceId_metric_periodStart: { workspaceId, metric: "AI_GENERATION", periodStart: start } },
    select: { count: true },
  });
  const allowancePerPeriod = paidFeaturesActive ? plan.aiGenerationsPerPeriod : 0;
  const usedThisPeriod = usage?.count ?? 0;
  const allowanceRemaining = Math.max(0, allowancePerPeriod - usedThisPeriod);

  const features = Object.fromEntries((Object.keys(ENTITLEMENT_KEYS) as EntitlementKey[]).map((k) => [k, false])) as Record<EntitlementKey, boolean>;
  if (paidFeaturesActive || plan.key === "FREE") {
    for (const ent of plan.entitlements) {
      if (ent.key in features) features[ent.key as EntitlementKey] = ent.enabled;
    }
  } else {
    // Lapsed subscription: fall back to free-tier features.
    features.PDF_DOWNLOAD = true;
    features.ACCEPTANCE_LINKS = true;
    features.BASIC_ANALYTICS = true;
  }

  return {
    planKey: plan.key,
    planName: plan.name,
    status: subscription.status,
    interval: subscription.interval,
    isTrial: plan.key === "FREE",
    paidFeaturesActive,
    allowancePerPeriod,
    usedThisPeriod,
    allowanceRemaining,
    creditBalance: workspace.aiCreditBalance,
    totalAvailable: allowanceRemaining + workspace.aiCreditBalance,
    maxMembers: plan.key === "FREE" || !paidFeaturesActive ? 1 : plan.maxMembers,
    memberCount: workspace._count.members,
    storageAllowanceMb: plan.storageAllowanceMb,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    features,
    paymentFailureMessage: subscription.status === "PAST_DUE" || subscription.status === "UNPAID" ? subscription.lastPaymentFailureMessage ?? "Your last payment failed." : null,
  };
}

export async function assertFeature(workspaceId: string, key: EntitlementKey): Promise<WorkspaceEntitlements> {
  const ent = await getWorkspaceEntitlements(workspaceId);
  if (!ent.features[key]) {
    throw new EntitlementError(`${ENTITLEMENT_KEYS[key]} is not included in your current plan. Upgrade to unlock it.`);
  }
  return ent;
}

export async function assertCanGenerate(workspaceId: string): Promise<WorkspaceEntitlements> {
  const ent = await getWorkspaceEntitlements(workspaceId);
  if (ent.totalAvailable <= 0) {
    throw new EntitlementError(
      ent.isTrial
        ? "You have used all of your free AI generations. Upgrade to Starter or Pro, or buy a credit pack to continue."
        : "You have used all of your AI generations for this billing period. Buy a credit pack or upgrade your plan to continue.",
    );
  }
  return ent;
}
