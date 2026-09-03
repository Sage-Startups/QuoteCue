import Link from "next/link";
import { FileText, Send, Eye, CheckCircle2, Wallet, TrendingUp } from "lucide-react";
import { getDemoWorkspace } from "@/lib/services/demo";
import { getWorkspaceStats, percentDelta } from "@/lib/services/analytics";
import { formatMoney } from "@/lib/utils/money";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/app/date-range-filter";
import { QuoteActivityChart, QuoteValueChart, StatusPieChart } from "@/components/app/charts";
import { ActivityFeed } from "@/components/app/activity-feed";

export default async function DemoDashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const demo = (await getDemoWorkspace())!;
  const stats = await getWorkspaceStats(demo.id, params.range ?? "90d", params.from, params.to);
  const currency = demo.settings?.currency ?? "GBP";
  const c = stats.current;
  const p = stats.previous;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Demonstration data"
        title={`${demo.name} dashboard`}
        description="Three months of sample quoting activity for a fictional electrical business. All figures are demonstration data."
        actions={
          <Button asChild variant="accent">
            <Link href="/demo/new-quote">Try creating a quote</Link>
          </Button>
        }
      />
      <DateRangeFilter current={stats.range.key} from={params.from} to={params.to} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Quotes created" value={c.quotesCreated} delta={{ value: percentDelta(c.quotesCreated, p.quotesCreated) }} icon={FileText} />
        <StatCard label="Quotes sent" value={c.quotesSent} delta={{ value: percentDelta(c.quotesSent, p.quotesSent) }} icon={Send} />
        <StatCard label="Quotes viewed" value={c.quotesViewed} delta={{ value: percentDelta(c.quotesViewed, p.quotesViewed) }} icon={Eye} />
        <StatCard label="Quotes accepted" value={c.quotesAccepted} delta={{ value: percentDelta(c.quotesAccepted, p.quotesAccepted) }} icon={CheckCircle2} />
        <StatCard label="Acceptance rate" value={`${c.acceptanceRate}%`} icon={TrendingUp} hint="Sample data" />
        <StatCard label="Value quoted" value={formatMoney(c.totalQuotedMinor, currency)} icon={Wallet} hint="Sample data" />
        <StatCard label="Value accepted" value={formatMoney(c.totalAcceptedMinor, currency)} icon={Wallet} hint="Sample data" />
        <StatCard label="Average quote" value={formatMoney(c.averageQuoteMinor, currency)} hint={c.averageCreateToSendHours !== null ? `${c.averageCreateToSendHours.toFixed(1)} h creation to send` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quote activity</CardTitle>
            <CardDescription>Created, sent and accepted per day (sample).</CardDescription>
          </CardHeader>
          <CardContent>
            <QuoteActivityChart data={stats.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Value quoted and accepted</CardTitle>
            <CardDescription>Sample data.</CardDescription>
          </CardHeader>
          <CardContent>
            <QuoteValueChart data={stats.series} currency={currency} />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotes by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPieChart data={stats.statusBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={stats.recentActivity.map((a) => ({ ...a }))} showQuote={false} />
            <p className="mt-3 text-xs text-muted-foreground">
              Open the{" "}
              <Link href="/demo/quotes" className="underline">
                quote list
              </Link>{" "}
              to see individual quotes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
