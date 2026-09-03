import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getWorkspaceStats, percentDelta } from "@/lib/services/analytics";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils/money";
import { PageHeader, StatCard, Alert } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/app/date-range-filter";
import { QuoteActivityChart, QuoteValueChart, StatusPieChart, SimpleBarChart } from "@/components/app/charts";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app/analytics");
  const [stats, entitlements, settings] = await Promise.all([
    getWorkspaceStats(ctx.workspace.id, params.range, params.from, params.to),
    getWorkspaceEntitlements(ctx.workspace.id),
    prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId: ctx.workspace.id }, select: { currency: true } }),
  ]);
  const currency = settings.currency;
  const c = stats.current;
  const p = stats.previous;
  const advanced = entitlements.features.ADVANCED_ANALYTICS;

  const [byCustomer, aiUsage, declineReasons] = advanced
    ? await Promise.all([
        prisma.quote.groupBy({ by: ["customerId"], where: { workspaceId: ctx.workspace.id, deletedAt: null, acceptedAt: { gte: stats.range.from, lte: stats.range.to } }, _sum: { totalMinor: true }, _count: { _all: true }, orderBy: { _sum: { totalMinor: "desc" } }, take: 8 }),
        prisma.aiRun.groupBy({ by: ["feature", "status"], where: { workspaceId: ctx.workspace.id, startedAt: { gte: stats.range.from, lte: stats.range.to } }, _count: { _all: true } }),
        prisma.quoteAcceptance.findMany({ where: { workspaceId: ctx.workspace.id, decision: "DECLINED", createdAt: { gte: stats.range.from, lte: stats.range.to } }, select: { reason: true }, take: 100 }),
      ])
    : [[], [], []];
  const customerIds = byCustomer.map((b) => b.customerId).filter((id): id is string => !!id);
  const customers = customerIds.length > 0 ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, contactName: true, companyName: true } }) : [];
  const customerName = (id: string | null) => {
    const cu = customers.find((x) => x.id === id);
    return cu ? (cu.companyName ?? cu.contactName) : "No customer";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="All figures are calculated from your quotes in the database." />
      <DateRangeFilter current={stats.range.key} from={params.from} to={params.to} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Created" value={c.quotesCreated} delta={{ value: percentDelta(c.quotesCreated, p.quotesCreated) }} />
        <StatCard label="Sent" value={c.quotesSent} delta={{ value: percentDelta(c.quotesSent, p.quotesSent) }} />
        <StatCard label="Viewed" value={c.quotesViewed} delta={{ value: percentDelta(c.quotesViewed, p.quotesViewed) }} />
        <StatCard label="Accepted" value={c.quotesAccepted} delta={{ value: percentDelta(c.quotesAccepted, p.quotesAccepted) }} />
        <StatCard label="Declined" value={c.quotesDeclined} delta={{ value: percentDelta(c.quotesDeclined, p.quotesDeclined) }} />
        <StatCard label="Acceptance rate" value={`${c.acceptanceRate}%`} hint={`${p.acceptanceRate}% previous`} />
        <StatCard label="Value quoted" value={formatMoney(c.totalQuotedMinor, currency)} delta={{ value: percentDelta(c.totalQuotedMinor, p.totalQuotedMinor) }} />
        <StatCard label="Value accepted" value={formatMoney(c.totalAcceptedMinor, currency)} delta={{ value: percentDelta(c.totalAcceptedMinor, p.totalAcceptedMinor) }} />
        <StatCard label="Average quote" value={formatMoney(c.averageQuoteMinor, currency)} hint={`${formatMoney(p.averageQuoteMinor, currency)} previous`} />
        <StatCard label="Create → send" value={c.averageCreateToSendHours === null ? "—" : c.averageCreateToSendHours < 1 ? `${Math.round(c.averageCreateToSendHours * 60)} min` : `${c.averageCreateToSendHours.toFixed(1)} h`} hint="Average time" />
        <StatCard label="AI generations" value={c.aiGenerations} delta={{ value: percentDelta(c.aiGenerations, p.aiGenerations) }} />
        <StatCard label="Remaining AI" value={entitlements.totalAvailable} hint={entitlements.planName} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quote activity</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteActivityChart data={stats.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Value quoted and accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteValueChart data={stats.series} currency={currency} />
          </CardContent>
        </Card>
      </div>
      {!advanced ? (
        <Alert variant="info" title="Advanced analytics">
          Top customers, AI usage breakdown and decline reasons are included in the Pro plan.{" "}
          {ctx.isAdmin ? (
            <Link href="/app/billing" className="font-semibold underline">
              Upgrade
            </Link>
          ) : null}
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Top customers by accepted value</CardTitle>
            </CardHeader>
            <CardContent>
              {byCustomer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accepted quotes in this period.</p>
              ) : (
                <SimpleBarChart data={byCustomer.map((b) => ({ name: customerName(b.customerId).slice(0, 14), value: b._sum.totalMinor ?? 0 }))} xKey="name" yKey="value" name="Accepted value" formatter={(v) => formatMoney(v, currency)} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>AI usage</CardTitle>
              <CardDescription>Runs by feature and outcome.</CardDescription>
            </CardHeader>
            <CardContent>
              {aiUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI runs in this period.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {aiUsage.map((u) => (
                    <li key={`${u.feature}-${u.status}`} className="flex justify-between">
                      <span>
                        {u.feature.replace(/_/g, " ").toLowerCase()} · {u.status.toLowerCase()}
                      </span>
                      <span className="font-semibold tabular">{u._count._all}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Status breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusPieChart data={stats.statusBreakdown} />
              {declineReasons.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decline reasons</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {declineReasons.slice(0, 5).map((r, i) => (
                      <li key={i} className="truncate">
                        {r.reason ?? "No reason given"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
      {entitlements.features.CSV_EXPORT ? (
        <Button asChild variant="secondary">
          <Link href={`/app/quotes/export?from=${stats.range.from.toISOString().slice(0, 10)}&to=${stats.range.to.toISOString().slice(0, 10)}`}>Export quotes for this period (CSV)</Link>
        </Button>
      ) : null}
    </div>
  );
}
