import type { Metadata } from "next";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ENTITLEMENT_KEYS, type EntitlementKey } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { minorToDecimalString } from "@/components/admin/format";
import { PlanForm, type PlanFormPlan } from "./plan-form";

export const metadata: Metadata = { title: "Plans and credits" };

export default async function PlansPage() {
  await requireSuperAdminForPage("/super-admin/plans");
  const [plans, subCounts] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], include: { entitlements: true } }),
    prisma.subscription.groupBy({ by: ["planId"], _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(subCounts.map((c) => [c.planId, c._count._all]));
  const stripeConfigured = isStripeConfigured();
  const entitlementKeys = (Object.keys(ENTITLEMENT_KEYS) as EntitlementKey[]).map((key) => ({ key, label: ENTITLEMENT_KEYS[key] }));
  const toForm = (p: (typeof plans)[number]): PlanFormPlan => ({
    id: p.id,
    key: p.key,
    kind: p.kind,
    name: p.name,
    description: p.description ?? "",
    monthlyPrice: minorToDecimalString(p.monthlyPriceMinor),
    annualPrice: minorToDecimalString(p.annualPriceMinor),
    oneTimePrice: minorToDecimalString(p.oneTimePriceMinor),
    aiGenerationsPerPeriod: p.aiGenerationsPerPeriod,
    creditsGranted: p.creditsGranted,
    maxMembers: p.maxMembers,
    storageAllowanceMb: p.storageAllowanceMb,
    featureBullets: Array.isArray(p.featureBullets) ? (p.featureBullets as string[]).join("\n") : "",
    stripeMonthlyPriceId: p.stripeMonthlyPriceId ?? "",
    stripeAnnualPriceId: p.stripeAnnualPriceId ?? "",
    stripeOneTimePriceId: p.stripeOneTimePriceId ?? "",
    isActive: p.isActive,
    isPublic: p.isPublic,
    highlight: p.highlight,
    sortOrder: p.sortOrder,
    entitlements: p.entitlements.filter((e) => e.enabled).map((e) => e.key),
  });
  const subscriptions = plans.filter((p) => p.kind === "SUBSCRIPTION");
  const packs = plans.filter((p) => p.kind === "CREDIT_PACK");
  return (
    <div className="space-y-6">
      <PageHeader title="Plans and credits" description="Prices, allowances, entitlements and Stripe price mappings. Changes apply to new checkouts immediately; existing Stripe subscriptions keep their Stripe price." />
      {!stripeConfigured ? <Alert variant="warning">Stripe is not configured (mock billing). Stripe price ids are checked for format only.</Alert> : null}
      <section className="space-y-4" aria-labelledby="subscription-plans">
        <h2 id="subscription-plans" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Subscription plans
        </h2>
        {subscriptions.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {p.name} <Badge variant="outline">{p.key}</Badge>
                {!p.isActive ? <Badge variant="muted">Inactive</Badge> : null}
                {!p.isPublic ? <Badge variant="muted">Hidden</Badge> : null}
                {p.highlight ? <Badge variant="accent">Highlighted</Badge> : null}
              </CardTitle>
              <CardDescription>
                {counts[p.id] ?? 0} subscription{(counts[p.id] ?? 0) === 1 ? "" : "s"} on this plan · currency {p.currency}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanForm plan={toForm(p)} entitlementKeys={entitlementKeys} stripeConfigured={stripeConfigured} />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-4" aria-labelledby="credit-packs">
        <h2 id="credit-packs" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Credit packs
        </h2>
        {packs.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {p.name} <Badge variant="outline">{p.key}</Badge>
                {!p.isActive ? <Badge variant="muted">Inactive</Badge> : null}
              </CardTitle>
              <CardDescription>One-time purchase that grants {p.creditsGranted} credits.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlanForm plan={toForm(p)} entitlementKeys={entitlementKeys} stripeConfigured={stripeConfigured} />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
