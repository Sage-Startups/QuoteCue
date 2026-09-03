import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils/money";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { completeMockCheckoutAction } from "../actions";
import type { PlanKey } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Mock checkout" };

export default async function MockCheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app/billing/mock-checkout");
  if (!ctx.isAdmin) redirect("/app");
  if (getEnv().isProduction) redirect("/app/billing");
  const plan = await prisma.plan.findUnique({ where: { key: (params.plan ?? "STARTER") as PlanKey } });
  if (!plan) redirect("/app/billing?error=plan");
  const interval = params.interval === "YEAR" ? "YEAR" : "MONTH";
  const price = plan.kind === "CREDIT_PACK" ? plan.oneTimePriceMinor : interval === "YEAR" ? plan.annualPriceMinor : plan.monthlyPriceMinor;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Alert variant="warning" title="Development mock checkout">
        Stripe is not configured (STRIPE_SECRET_KEY is empty). This page simulates a successful Stripe Checkout so you can test plan changes. Nothing is charged and production refuses this flow.
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>{plan.name}</CardTitle>
          <CardDescription>{plan.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-bold">
            {formatMoney(price, "USD")} <span className="text-sm font-normal text-muted-foreground">{plan.kind === "CREDIT_PACK" ? "one-time" : interval === "YEAR" ? "per year" : "per month"}</span>
          </p>
          <form action={completeMockCheckoutAction} className="flex gap-2">
            <input type="hidden" name="plan" value={plan.key} />
            <input type="hidden" name="interval" value={interval} />
            <Button type="submit" variant="accent">
              Simulate successful payment
            </Button>
            <Button asChild variant="ghost">
              <Link href="/app/billing?checkout=cancelled">Cancel</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
