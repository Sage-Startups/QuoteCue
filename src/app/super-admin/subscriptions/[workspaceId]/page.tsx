import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditEntryList, DescriptionList, InlineLink } from "@/components/admin/misc";
import { DemoBadge, SubscriptionStatusBadge } from "@/components/admin/badges";
import { ComplimentaryPlanForm } from "../../users/[id]/panels";
import { isUuid, maskId } from "../../_lib/admin";
import { SubscriptionQuickActions, ChangePlanForm } from "./panels";
import type { Currency } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Subscription" };

function stripeCustomerUrl(customerId: string | null): string | null {
  if (!customerId || customerId.startsWith("cus_mock_") || customerId.startsWith("cus_demo_")) return null;
  const live = getEnv().APP_URL.startsWith("https://");
  return `https://dashboard.stripe.com/${live ? "" : "test/"}customers/${customerId}`;
}

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  await requireSuperAdminForPage(`/super-admin/subscriptions/${workspaceId}`);
  if (!isUuid(workspaceId)) notFound();
  const sub = await prisma.subscription.findUnique({ where: { workspaceId }, include: { plan: true, workspace: { select: { id: true, name: true, slug: true, isDemo: true, aiCreditBalance: true, deletedAt: true, owner: { select: { id: true, name: true, email: true } } } } } });
  if (!sub || sub.workspace.deletedAt) notFound();
  const [invoices, ledger, plans, audit] = await Promise.all([
    prisma.billingInvoice.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.creditLedgerEntry.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } }),
    prisma.plan.findMany({ where: { kind: "SUBSCRIPTION", isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.adminAuditLog.findMany({ where: { targetType: "workspace", targetId: workspaceId, action: { startsWith: "subscription." } }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { name: true, email: true } } } }),
  ]);
  const stripeConfigured = isStripeConfigured();
  const customerUrl = stripeCustomerUrl(sub.stripeCustomerId);
  const live = getEnv().APP_URL.startsWith("https://");
  const hasRealStripeSub = !!sub.stripeSubscriptionId && !sub.stripeSubscriptionId.startsWith("sub_mock_");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/subscriptions" className="hover:underline">
            Subscriptions
          </Link>
        }
        title={sub.workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{sub.plan.name}</span>
            <SubscriptionStatusBadge status={sub.status} />
            {sub.cancelAtPeriodEnd ? <Badge variant="warning">Cancels at period end</Badge> : null}
            {sub.workspace.isDemo ? <DemoBadge /> : null}
          </span>
        }
        actions={<SubscriptionQuickActions workspaceId={workspaceId} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} hasStripeSubscription={hasRealStripeSub} stripeConfigured={stripeConfigured} />}
      />
      {!stripeConfigured ? <Alert variant="warning">Stripe is not configured: billing runs in mock mode. Stripe actions are disabled.</Alert> : null}
      {sub.lastPaymentFailureAt ? (
        <Alert variant="destructive" title={`Last payment failure ${formatDateTime(sub.lastPaymentFailureAt)}`}>
          {sub.lastPaymentFailureMessage ?? "No message recorded."}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Synchronised Stripe state</CardTitle>
            <CardDescription>Local copy of the subscription as last synced from Stripe.</CardDescription>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Workspace", value: <InlineLink href={`/super-admin/workspaces/${workspaceId}`}>{sub.workspace.name}</InlineLink> },
                { label: "Owner", value: <InlineLink href={`/super-admin/users/${sub.workspace.owner.id}`}>{sub.workspace.owner.email}</InlineLink> },
                { label: "Plan", value: `${sub.plan.name} (${sub.plan.key})` },
                { label: "Status", value: <SubscriptionStatusBadge status={sub.status} /> },
                { label: "Interval", value: sub.interval === "YEAR" ? "Annual" : "Monthly" },
                { label: "Current period", value: `${formatDate(sub.currentPeriodStart)} – ${formatDate(sub.currentPeriodEnd)}` },
                { label: "Cancel at period end", value: sub.cancelAtPeriodEnd ? `Yes${sub.canceledAt ? ` (requested ${formatDateTime(sub.canceledAt)})` : ""}` : "No" },
                { label: "Trial ends", value: sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "—" },
                { label: "Complimentary until", value: sub.complimentaryUntil ? `${formatDate(sub.complimentaryUntil)}${sub.complimentaryReason ? ` · ${sub.complimentaryReason}` : ""}` : "—" },
                { label: "Stripe customer", value: <span className="font-mono text-xs">{maskId(sub.stripeCustomerId)}</span> },
                { label: "Stripe subscription", value: <span className="font-mono text-xs">{maskId(sub.stripeSubscriptionId)}</span> },
                { label: "Stripe price", value: <span className="font-mono text-xs">{maskId(sub.stripePriceId)}</span> },
                { label: "Last synced", value: sub.lastSyncedAt ? formatDateTime(sub.lastSyncedAt) : "Never" },
                { label: "Credit balance", value: sub.workspace.aiCreditBalance },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {customerUrl ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={customerUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Open Stripe customer ({live ? "live" : "test"})
                  </a>
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">No Stripe customer linked{sub.stripeCustomerId ? " (mock customer)" : ""}.</span>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/super-admin/webhooks">View webhook events</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change plan mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <ChangePlanForm workspaceId={workspaceId} currentPlanId={sub.planId} plans={plans} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Complimentary entitlement</CardTitle>
              <CardDescription>Grants paid-plan entitlements without payment until the chosen date.</CardDescription>
            </CardHeader>
            <CardContent>
              <ComplimentaryPlanForm workspaces={[{ id: workspaceId, name: sub.workspace.name, isDemo: sub.workspace.isDemo }]} plans={plans} defaultWorkspaceId={workspaceId} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{formatDate(inv.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.number ?? maskId(inv.stripeInvoiceId)}</TableCell>
                    <TableCell className="text-sm">{inv.description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "success" : inv.status === "open" ? "warning" : "muted"}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatMoney(inv.amountDueMinor, (inv.currency.toUpperCase() as Currency) || "USD")}</TableCell>
                    <TableCell className="text-right tabular">{formatMoney(inv.amountPaidMinor, (inv.currency.toUpperCase() as Currency) || "USD")}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle>Credit ledger</CardTitle>
          <CardDescription>Most recent 50 entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ledger entries.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.type.toLowerCase().replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.reason ?? "—"}
                      {l.user ? <span className="block text-xs text-muted-foreground">{l.user.name}</span> : null}
                    </TableCell>
                    <TableCell className={`text-right tabular ${l.delta > 0 ? "text-success" : ""}`}>
                      {l.delta > 0 ? "+" : ""}
                      {l.delta}
                    </TableCell>
                    <TableCell className="text-right tabular">{l.balanceAfter}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription audit history</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditEntryList entries={audit} currentTargetId={workspaceId} formatDateTime={formatDateTime} />
        </CardContent>
      </Card>
    </div>
  );
}
