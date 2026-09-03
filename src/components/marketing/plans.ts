import "server-only";
import { prisma } from "@/lib/db";

export type { PublicPlan } from "./plans-shared";
export { planSignupHref } from "./plans-shared";
import type { PublicPlan } from "./plans-shared";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** Public, active plans ordered for display. Safe to pass to client components. */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  const rows = await prisma.plan.findMany({
    where: { isActive: true, isPublic: true },
    orderBy: { sortOrder: "asc" },
    include: { entitlements: true },
  });
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    kind: row.kind,
    name: row.name,
    description: row.description,
    monthlyPriceMinor: row.monthlyPriceMinor,
    annualPriceMinor: row.annualPriceMinor,
    oneTimePriceMinor: row.oneTimePriceMinor,
    aiGenerationsPerPeriod: row.aiGenerationsPerPeriod,
    creditsGranted: row.creditsGranted,
    maxMembers: row.maxMembers,
    highlight: row.highlight,
    featureBullets: toStringArray(row.featureBullets),
    entitlements: row.entitlements.filter((e) => e.enabled).map((e) => e.key),
  }));
}

