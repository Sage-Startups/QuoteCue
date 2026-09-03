import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard, Sparkles } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader, Alert, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PlanCards } from "@/components/billing/plan-cards";
import { startCheckoutAction, openPortalAction, cancelSubscriptionAction } from "./actions";

export const metadata: Metadata = { title: "Billing" };

const STATUS_LABEL: Record<string, string> = { TRIALING: "Trial", ACTIVE: "Active", PAST_DUE: "Past due", CANCELED: "Cancelled", UNPAID: "Unpaid", INCOMPLETE: "Incomplete", INCOMPLETE_EXPIRED: "Expired", PAUSED: "Paused", COMPLIMENTARY: "Complimentary" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; error?: string; mock?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app/billing");
  if (!ctx.isAdmin && !ctx.supportSession) redirect("/app");
  const [entitlements, plans, subscription, invoices, ledger] = await Promise.all([
    getWorkspaceEntitlements(ctx.workspace.id),
    prisma.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } }),
    prisma.subscription.findUnique({ where: { workspaceId: ctx.workspace.id } }),
    prisma.billingInvoice.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.creditLedgerEntry.findMany({ where: { workspaceId: ctx.workspace.id, type: { not: "CONSUMPTION" } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const subscriptionPlans = plans.filter((p) => p.kind === "SUBSCRIPTION");
  const packs = plans.filter((p) => p.kind === "CREDIT_PACK");
  const mock = !isStripeConfigured();
  const readOnly = !!ctx.supportSession;
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Manage your plan, AI generations and invoices." />
      {params.checkout === "success" ? (
        <Alert variant="success" title="Thank you">
          {params.mock ? "Mock checkout completed: your plan has been updated for development." : "Your payment was successful. Your plan updates as soon as Stripe confirms it."}
        </Alert>
      ) : null}
      {params.checkout === "cancelled" ? <Alert variant="info">Checkout was cancelled. No changes were made.</Alert> : null}
      {params.error ? <Alert variant="destructive">{params.error}</Alert> : null}
      {entitlements.paymentFailureMessage ? (
        <Alert variant="destructive" title="Payment failed">
          {entitlements.paymentFailureMessage} Update your payment method to keep your plan active.
        </Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Plan" value={entitlements.planName} hint={STATUS_LABEL[entitlements.status] ?? entitlements.status} icon={CreditCard} />
        <StatCard label="AI generations left" value={entitlements.totalAvailable} hint={entitlements.allowancePerPeriod > 0 ? `${entitlements.allowanceRemaining} allowance + ${entitlements.creditBalance} credits` : `${entitlements.creditBalance} credits`} icon={Sparkles} />
        <StatCard label="Period ends" value={formatDate(entitlements.currentPeriodEnd)} hint={entitlements.cancelAtPeriodEnd ? "Cancels at period end" : entitlements.interval === "YEAR" ? "Annual billing" : "Monthly billing"} />
        <StatCard label="Team seats" value={`${entitlements.memberCount} / ${entitlements.maxMembers}`} />
      </div>
      {!readOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>Upgrade, downgrade or switch billing interval. Changes take effect immediately through Stripe.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanCards
              plans={subscriptionPlans.map((p) => ({ key: p.key, name: p.name, description: p.description, monthlyPriceMinor: p.monthlyPriceMinor, annualPriceMinor: p.annualPriceMinor, aiGenerationsPerPeriod: p.aiGenerationsPerPeriod, maxMembers: p.maxMembers, highlight: p.highlight, featureBullets: Array.isArray(p.featureBullets) ? (p.featureBullets as string[]) : [] }))}
              currentKey={entitlements.paidFeaturesActive ? entitlements.planKey : "FREE"}
              currentInterval={entitlements.interval}
              action={startCheckoutAction}
              isMock={mock}
            />
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Extra AI generations</CardTitle>
            <CardDescription>Credits never expire and work on any plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {packs.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
                {!readOnly ? (
                  <form action={startCheckoutAction}>
                    <input type="hidden" name="plan" value={p.key} />
                    <input type="hidden" name="interval" value="MONTH" />
                    <Button type="submit" variant="secondary">
                      Buy for {formatMoney(p.oneTimePriceMinor, "USD")}
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
            {ledger.length > 0 ? (
              <div className="pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit history</p>
                <ul className="mt-1 divide-y text-sm">
                  {ledger.map((l) => (
                    <li key={l.id} className="flex justify-between py-1.5">
                      <span>
                        {l.reason ?? l.type.toLowerCase()} <span className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</span>
                      </span>
                      <span className={l.delta >= 0 ? "font-semibold text-success" : "font-semibold"}>
                        {l.delta >= 0 ? "+" : ""}
                        {l.delta}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Payment method, invoices and cancellation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Status: <Badge variant={entitlements.paidFeaturesActive ? "success" : "warning"}>{STATUS_LABEL[entitlements.status] ?? entitlements.status}</Badge>
              {subscription?.cancelAtPeriodEnd ? <span className="ml-2 text-muted-foreground">Ends {formatDate(subscription.currentPeriodEnd)}</span> : null}
            </p>
            {!readOnly && subscription?.stripeCustomerId ? (
              <form action={openPortalAction}>
                <Button type="submit" variant="secondary">
                  {mock ? "Open mock billing portal" : "Manage payment method and invoices"}
                </Button>
              </form>
            ) : null}
            {!readOnly && !entitlements.isTrial && subscription?.stripeSubscriptionId ? (
              subscription.cancelAtPeriodEnd ? (
                <ConfirmButton action={cancelSubscriptionAction} hidden={{ cancel: "false" }} variant="default">
                  Restore subscription
                </ConfirmButton>
              ) : (
                <ConfirmButton action={cancelSubscriptionAction} hidden={{ cancel: "true" }} variant="ghost" confirmTitle="Cancel at period end?" confirmDescription="You keep access until the end of the current billing period. Purchased credits are kept." confirmLabel="Cancel subscription">
                  Cancel at period end
                </ConfirmButton>
              )
            ) : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{formatDate(inv.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.number ?? "—"}</TableCell>
                    <TableCell>{inv.description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "success" : inv.status === "open" ? "warning" : "muted"}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatMoney(inv.amountPaidMinor || inv.amountDueMinor, (inv.currency as "USD") || "USD")}</TableCell>
                    <TableCell className="text-right">
                      {inv.hostedInvoiceUrl ? (
                        <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline">
                          View
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
