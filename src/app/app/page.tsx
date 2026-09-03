import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Send, Eye, CheckCircle2, Wallet, TrendingUp, Timer, Sparkles } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getWorkspaceStats, percentDelta } from "@/lib/services/analytics";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader, StatCard, Alert, Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/app/date-range-filter";
import { QuoteActivityChart, StatusPieChart } from "@/components/app/charts";
import { ActivityFeed } from "@/components/app/activity-feed";
import { QuoteStatusBadge } from "@/components/app/status-badge";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; welcome?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app");
  const [stats, entitlements, settings, followUps] = await Promise.all([
    getWorkspaceStats(ctx.workspace.id, params.range, params.from, params.to),
    getWorkspaceEntitlements(ctx.workspace.id),
    prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId: ctx.workspace.id }, select: { currency: true } }),
    prisma.quote.findMany({
      where: { workspaceId: ctx.workspace.id, deletedAt: null, status: { in: ["SENT", "VIEWED"] }, followUpAt: { lte: new Date() } },
      orderBy: { followUpAt: "asc" },
      take: 5,
      include: { customer: { select: { contactName: true, companyName: true } } },
    }),
  ]);
  const currency = settings.currency;
  const c = stats.current;
  const p = stats.previous;
  const hours = c.averageCreateToSendHours;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${ctx.user.name.split(" ")[0]}`}
        description={ctx.workspace.isDemo ? "Demonstration workspace with sample data." : "Here is how your quoting is going."}
        actions={
          <>
            <Button asChild variant="accent">
              <Link href="/app/quotes/new">New quote</Link>
            </Button>
          </>
        }
      />
      {params.welcome ? (
        <Alert variant="success" title="Your workspace is ready">
          Start by creating a quote from a customer message, or explore your service catalogue and templates.
        </Alert>
      ) : null}
      {entitlements.paymentFailureMessage ? (
        <Alert variant="destructive" title="Payment problem">
          {entitlements.paymentFailureMessage}{" "}
          <Link href="/app/billing" className="font-semibold underline">
            Update billing
          </Link>
        </Alert>
      ) : null}
      {entitlements.totalAvailable === 0 ? (
        <Alert variant="warning" title="No AI generations left">
          {entitlements.isTrial ? "Your free trial generations are used up." : "You have used this period's allowance."}{" "}
          <Link href="/app/billing" className="font-semibold underline">
            Upgrade or buy credits
          </Link>
        </Alert>
      ) : null}

      <DateRangeFilter current={stats.range.key} from={params.from} to={params.to} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Quotes created" value={c.quotesCreated} delta={{ value: percentDelta(c.quotesCreated, p.quotesCreated) }} icon={FileText} />
        <StatCard label="Quotes sent" value={c.quotesSent} delta={{ value: percentDelta(c.quotesSent, p.quotesSent) }} icon={Send} />
        <StatCard label="Quotes viewed" value={c.quotesViewed} delta={{ value: percentDelta(c.quotesViewed, p.quotesViewed) }} icon={Eye} />
        <StatCard label="Quotes accepted" value={c.quotesAccepted} delta={{ value: percentDelta(c.quotesAccepted, p.quotesAccepted) }} icon={CheckCircle2} />
        <StatCard label="Acceptance rate" value={`${c.acceptanceRate}%`} hint={`${p.acceptanceRate}% previous period`} icon={TrendingUp} />
        <StatCard label="Value quoted" value={formatMoney(c.totalQuotedMinor, currency)} delta={{ value: percentDelta(c.totalQuotedMinor, p.totalQuotedMinor) }} icon={Wallet} />
        <StatCard label="Value accepted" value={formatMoney(c.totalAcceptedMinor, currency)} delta={{ value: percentDelta(c.totalAcceptedMinor, p.totalAcceptedMinor) }} icon={Wallet} />
        <StatCard label="Average quote" value={formatMoney(c.averageQuoteMinor, currency)} hint={hours !== null ? `Avg ${hours < 1 ? `${Math.round(hours * 60)} min` : `${hours.toFixed(1)} h`} from creation to send` : "No quotes sent yet"} icon={Timer} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quote activity</CardTitle>
            <CardDescription>Created, sent and accepted per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <QuoteActivityChart data={stats.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plan usage</CardTitle>
            <CardDescription>{entitlements.planName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-accent" aria-hidden="true" /> AI generations
                </span>
                <span className="font-semibold tabular">{entitlements.totalAvailable} remaining</span>
              </div>
              {entitlements.allowancePerPeriod > 0 ? (
                <>
                  <Progress className="mt-2" value={entitlements.usedThisPeriod} max={entitlements.allowancePerPeriod} label="Allowance used" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entitlements.usedThisPeriod} of {entitlements.allowancePerPeriod} used · resets {formatDate(entitlements.currentPeriodEnd)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{entitlements.isTrial ? "Free trial credits (no monthly allowance)" : "No monthly allowance on this plan"}</p>
              )}
              {entitlements.creditBalance > 0 ? <p className="mt-1 text-xs text-muted-foreground">{entitlements.creditBalance} purchased credits available</p> : null}
            </div>
            <div className="text-sm">
              <p className="flex items-center justify-between">
                <span>Team members</span>
                <span className="font-semibold tabular">
                  {entitlements.memberCount} / {entitlements.maxMembers}
                </span>
              </p>
            </div>
            {ctx.isAdmin ? (
              <Button asChild variant="secondary" className="w-full">
                <Link href="/app/billing">Manage plan</Link>
              </Button>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotes by status</p>
              <StatusPieChart data={stats.statusBreakdown} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={stats.recentActivity} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Follow-ups due</CardTitle>
            <CardDescription>Sent quotes waiting for a decision.</CardDescription>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to chase right now.</p>
            ) : (
              <ul className="divide-y">
                {followUps.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/app/quotes/${q.id}`} className="block truncate text-sm font-semibold hover:underline">
                        {q.number} · {q.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {q.customer ? (q.customer.companyName ?? q.customer.contactName) : "No customer"} · follow up {formatDate(q.followUpAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular">{formatMoney(q.totalMinor, q.currency)}</span>
                      <QuoteStatusBadge status={q.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
