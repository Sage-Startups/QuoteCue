import type { PlanKey, PlanKind } from "@/generated/prisma/enums";

export interface PublicPlan {
  id: string;
  key: PlanKey;
  kind: PlanKind;
  name: string;
  description: string | null;
  monthlyPriceMinor: number;
  annualPriceMinor: number;
  oneTimePriceMinor: number;
  aiGenerationsPerPeriod: number;
  creditsGranted: number;
  maxMembers: number;
  highlight: boolean;
  featureBullets: string[];
  entitlements: string[];
}

export function planSignupHref(plan: Pick<PublicPlan, "key" | "kind">, interval?: "monthly" | "annual"): string {
  if (plan.key === "FREE") return "/signup";
  if (plan.kind === "CREDIT_PACK") return "/signup";
  const params = new URLSearchParams({ plan: plan.key.toLowerCase() });
  if (interval === "annual") params.set("interval", "annual");
  return `/signup?${params.toString()}`;
}
