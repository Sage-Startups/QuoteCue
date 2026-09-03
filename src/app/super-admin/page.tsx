import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserPlus, Building2, CreditCard, TrendingUp, Wallet, FileText, Sparkles, Mail, HardDrive, Activity, Webhook, AlertTriangle, CheckCircle2, Package } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { percentDelta } from "@/lib/services/analytics";
import { formatDateTime, formatRelative } from "@/lib/utils/dates";
import { PageHeader, StatCard, Alert } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/app/date-range-filter";
import { AdminSeriesChart } from "@/components/admin/admin-charts";
import { ExcludeDemoToggle } from "@/components/admin/filters";
import { formatBytes, formatNumber, formatUsdMicros, formatUsdMinor, hoursSince } from "@/components/admin/format";
import { excludeDemoFrom } from "./_lib/admin";
import { getPlatformStats } from "./_lib/overview-stats";

export const metadata: Metadata = { title: "Overview" };

export default async function SuperAdminOverviewPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; excludeDemo?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin");
  const excludeDemo = excludeDemoFrom(params.excludeDemo);
  const stats = await getPlatformStats(params.range, params.from, params.to, excludeDemo);
  const c = stats.current;
  const p = stats.previous;
  const s = stats.snapshot;
  const heartbeatHours = hoursSince(s.lastHeartbeatAt);
  const heartbeatStale = heartbeatHours === null || heartbeatHours > 26;
  const costPerSuccess = c.aiSucceeded > 0 ? Math.round(c.aiCostMicros / c.aiSucceeded) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Users, revenue, quoting and AI activity across every workspace." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter current={stats.range.key} from={params.from} to={params.to} />
        <ExcludeDemoToggle excluded={excludeDemo} />
      </div>
      {!excludeDemo ? <Alert variant="warning">Demo workspace data is included in these figures. Demonstration data does not represent real customers.</Alert> : null}
      {(heartbeatStale || s.failedWebhooks > 0 || stats.recentErrors.length > 0) && (
        <div className="grid gap-3 md:grid-cols-3">
          <Alert variant={heartbeatStale ? "destructive" : "success"} title="Cron heartbeat">
            {s.lastHeartbeatAt ? `Last heartbeat ${formatRelative(s.lastHeartbeatAt)}` : "No heartbeat recorded yet"}.{" "}
            <Link href="/super-admin/jobs" className="font-semibold underline">
              Background jobs
            </Link>
          </Alert>
          <Alert variant={s.failedWebhooks > 0 ? "warning" : "success"} title="Stripe webhooks">
            {s.failedWebhooks} failed event{s.failedWebhooks === 1 ? "" : "s"}.{" "}
            <Link href="/super-admin/webhooks?status=FAILED" className="font-semibold underline">
              Review
            </Link>
          </Alert>
          <Alert variant={stats.recentErrors.length > 0 ? "warning" : "success"} title="Application errors">
            {stats.recentErrors.length} recent error{stats.recentErrors.length === 1 ? "" : "s"} recorded.{" "}
            <Link href="/super-admin/system-health" className="font-semibold underline">
              System health
            </Link>
          </Alert>
        </div>
      )}

      <section aria-labelledby="users-heading" className="space-y-3">
        <h2 id="users-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Users and workspaces
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total users" value={formatNumber(s.totalUsers)} hint={`${s.verifiedTotal} verified · ${s.suspendedUsers} suspended`} icon={Users} />
          <StatCard label="New users" value={formatNumber(c.newUsers)} delta={{ value: percentDelta(c.newUsers, p.newUsers) }} icon={UserPlus} />
          <StatCard label="Verified (new)" value={formatNumber(c.verifiedUsers)} delta={{ value: percentDelta(c.verifiedUsers, p.verifiedUsers) }} icon={CheckCircle2} />
          <StatCard label="Active users" value={formatNumber(c.activeUsers)} delta={{ value: percentDelta(c.activeUsers, p.activeUsers) }} icon={Activity} />
          <StatCard label="Total workspaces" value={formatNumber(s.totalWorkspaces)} hint={`${c.newWorkspaces} created this period`} icon={Building2} />
          <StatCard label="Active trials" value={formatNumber(s.activeTrials)} hint="Free plan, trialing" icon={Building2} />
          <StatCard label="Trial to paid" value={`${c.trialToPaidPercent}%`} hint={`${p.trialToPaidPercent}% previous period`} icon={TrendingUp} />
          <StatCard label="Churn" value={`${c.churnPercent}%`} hint={`${c.cancelled} cancelled · ${p.churnPercent}% previous`} icon={TrendingUp} />
        </div>
      </section>

      <section aria-labelledby="revenue-heading" className="space-y-3">
        <h2 id="revenue-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Revenue
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="MRR" value={formatUsdMinor(s.mrrMinor)} hint={`ARR ${formatUsdMinor(s.arrMinor)}`} icon={Wallet} />
          <StatCard label="Active subscriptions" value={formatNumber(s.activeSubscriptions)} hint={`${s.starterCount} Starter · ${s.proCount} Pro`} icon={CreditCard} />
          <StatCard label="Past due / cancelled" value={`${s.pastDue} / ${s.cancelledTotal}`} hint={`${s.complimentary} complimentary`} icon={AlertTriangle} />
          <StatCard label="Credit packs" value={formatUsdMinor(c.creditPackRevenueMinor)} hint={`${c.creditPacksSold} sold this period`} icon={Package} />
        </div>
      </section>

      <section aria-labelledby="quotes-heading" className="space-y-3">
        <h2 id="quotes-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quotes
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Created" value={formatNumber(c.quotesCreated)} delta={{ value: percentDelta(c.quotesCreated, p.quotesCreated) }} icon={FileText} />
          <StatCard label="Sent" value={formatNumber(c.quotesSent)} delta={{ value: percentDelta(c.quotesSent, p.quotesSent) }} />
          <StatCard label="Viewed" value={formatNumber(c.quotesViewed)} delta={{ value: percentDelta(c.quotesViewed, p.quotesViewed) }} />
          <StatCard label="Accepted" value={formatNumber(c.quotesAccepted)} delta={{ value: percentDelta(c.quotesAccepted, p.quotesAccepted) }} />
          <StatCard label="Acceptance rate" value={`${c.acceptanceRate}%`} hint={`${p.acceptanceRate}% previous period`} />
        </div>
      </section>

      <section aria-labelledby="ai-heading" className="space-y-3">
        <h2 id="ai-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          AI, email and storage
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="AI generations" value={formatNumber(c.aiRuns)} delta={{ value: percentDelta(c.aiRuns, p.aiRuns) }} icon={Sparkles} />
          <StatCard label="AI success / failure" value={`${c.aiRuns > 0 ? Math.round((c.aiSucceeded / c.aiRuns) * 100) : 0}% / ${c.aiRuns > 0 ? Math.round((c.aiFailed / c.aiRuns) * 100) : 0}%`} hint={`${c.aiSucceeded} succeeded · ${c.aiFailed} failed`} />
          <StatCard label="Estimated AI cost" value={formatUsdMicros(c.aiCostMicros)} hint={`${formatUsdMicros(costPerSuccess, { precise: true })} per successful generation`} />
          <StatCard label="Emails" value={formatNumber(c.emailsSent)} hint={`${c.emailsFailed} failed`} icon={Mail} />
          <StatCard label="Storage used" value={formatBytes(s.storageBytes)} hint={`${formatNumber(s.storageObjects)} objects`} icon={HardDrive} />
          <StatCard label="Cron heartbeat" value={s.lastHeartbeatAt ? formatRelative(s.lastHeartbeatAt) : "None"} hint={heartbeatStale ? "Stale: more than 26 hours" : "Healthy"} icon={Activity} />
          <StatCard label="Failed webhooks" value={formatNumber(s.failedWebhooks)} icon={Webhook} />
          <StatCard label="Recent errors" value={formatNumber(stats.recentErrors.length)} hint="Last 10 recorded" icon={AlertTriangle} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sign-ups and workspaces</CardTitle>
            <CardDescription>New users and workspaces per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminSeriesChart data={stats.series} label="New users and workspaces per day" series={[{ key: "users", name: "Users", color: "#2b4a86" }, { key: "workspaces", name: "Workspaces", color: "#d97706" }]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quotes and AI runs</CardTitle>
            <CardDescription>Quotes created, sent and accepted, with AI generations.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminSeriesChart type="line" data={stats.series} label="Quotes and AI runs per day" series={[{ key: "quotes", name: "Quotes created", color: "#7f97c8" }, { key: "sent", name: "Sent", color: "#2b4a86" }, { key: "accepted", name: "Accepted", color: "#15803d" }, { key: "aiRuns", name: "AI runs", color: "#d97706" }]} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent application errors</CardTitle>
          <CardDescription>The ten most recent errors recorded by the application.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No application errors recorded.</p>
          ) : (
            <ul className="divide-y">
              {stats.recentErrors.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Badge variant="outline" className="mb-1">
                      {e.scope}
                    </Badge>
                    <p className="break-words text-sm">{e.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
