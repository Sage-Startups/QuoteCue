import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, CheckCircle2, XCircle, Coins, Cpu } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader, StatCard, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/app/date-range-filter";
import { AdminSeriesChart, CategoryBarChart } from "@/components/admin/admin-charts";
import { ExcludeDemoToggle } from "@/components/admin/filters";
import { CsvExportLink } from "@/components/admin/misc";
import { DemoBadge } from "@/components/admin/badges";
import { formatNumber, formatUsdMicros, percent } from "@/components/admin/format";
import { excludeDemoFrom, exportQuery } from "../_lib/admin";
import { getAiUsageStats } from "./stats";

export const metadata: Metadata = { title: "AI usage" };

export default async function AiUsagePage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; excludeDemo?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/ai-usage");
  const excludeDemo = excludeDemoFrom(params.excludeDemo);
  const stats = await getAiUsageStats(params.range, params.from, params.to, excludeDemo);
  const t = stats.totals;
  const costPerGeneration = t.generationSuccesses > 0 ? Math.round(t.costMicros / t.generationSuccesses) : 0;
  return (
    <div className="space-y-6">
      <PageHeader title="AI usage" description="Runs, success rates, tokens and estimated cost across the platform." actions={<CsvExportLink href={`/super-admin/ai-usage/export?${exportQuery(params)}`} label="Export runs CSV" />} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter current={stats.range.key} from={params.from} to={params.to} />
        <ExcludeDemoToggle excluded={excludeDemo} />
      </div>
      {!excludeDemo ? <Alert variant="warning">Demo workspace runs are included in these figures.</Alert> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Runs" value={formatNumber(t.runs)} hint={`${t.running} still running`} icon={Sparkles} />
        <StatCard label="Succeeded" value={formatNumber(t.succeeded)} hint={`${percent(t.succeeded, t.runs)} success rate`} icon={CheckCircle2} />
        <StatCard label="Failed" value={formatNumber(t.failed)} hint={`${percent(t.failed, t.runs)} failure rate`} icon={XCircle} />
        <StatCard label="Estimated cost" value={formatUsdMicros(t.costMicros)} hint={`${formatUsdMicros(costPerGeneration, { precise: true })} per successful generation`} icon={Coins} />
        <StatCard label="Input tokens" value={formatNumber(t.inputTokens)} icon={Cpu} />
        <StatCard label="Output tokens" value={formatNumber(t.outputTokens)} />
        <StatCard label="Audio transcribed" value={`${Math.round(t.audioSeconds / 60)} min`} />
        <StatCard label="Billable generations" value={formatNumber(t.generationSuccesses)} hint="Successful enquiry analyses and wording runs" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Runs per day</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminSeriesChart data={stats.series} label="AI runs per day" series={[{ key: "runs", name: "Runs", color: "#2b4a86" }, { key: "failed", name: "Failed", color: "#b91c1c" }]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estimated cost per day</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminSeriesChart type="line" data={stats.series} label="Estimated AI cost per day" series={[{ key: "costMicros", name: "Cost", color: "#d97706" }]} formatter={(v) => formatUsdMicros(v)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By feature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryBarChart data={stats.byFeature.map((f) => ({ feature: f.feature.toLowerCase().replace(/_/g, " "), runs: f.runs }))} xKey="feature" yKey="runs" name="Runs" label="Runs by feature" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Tokens in / out</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byFeature.map((f) => (
                  <TableRow key={f.feature}>
                    <TableCell className="text-sm">{f.feature}</TableCell>
                    <TableCell className="text-right tabular">{formatNumber(f.runs)}</TableCell>
                    <TableCell className="text-right tabular">{percent(f.succeeded, f.runs)}</TableCell>
                    <TableCell className="text-right tabular text-xs">
                      {formatNumber(f.inputTokens)} / {formatNumber(f.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular">{formatUsdMicros(f.costMicros)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryBarChart data={stats.byModel.map((m) => ({ model: m.model, cost: m.costMicros }))} xKey="model" yKey="cost" name="Estimated cost" color="#d97706" label="Cost by model" formatter={(v) => formatUsdMicros(v)} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byModel.map((m) => (
                  <TableRow key={`${m.provider}:${m.model}`}>
                    <TableCell className="font-mono text-xs">{m.model}</TableCell>
                    <TableCell>
                      <Badge variant={m.provider === "mock" ? "warning" : "outline"}>{m.provider}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatNumber(m.runs)}</TableCell>
                    <TableCell className="text-right tabular">{percent(m.succeeded, m.runs)}</TableCell>
                    <TableCell className="text-right tabular">{formatUsdMicros(m.costMicros)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top workspaces</CardTitle>
          <CardDescription>Twenty workspaces with the most runs in the period.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.byWorkspace.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspace runs in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byWorkspace.map((w) => (
                  <TableRow key={w.workspaceId}>
                    <TableCell>
                      <Link href={`/super-admin/workspaces/${w.workspaceId}`} className="font-semibold hover:underline">
                        {w.name}
                      </Link>{" "}
                      {w.isDemo ? <DemoBadge /> : null}
                    </TableCell>
                    <TableCell className="text-right tabular">{formatNumber(w.runs)}</TableCell>
                    <TableCell className="text-right tabular">{percent(w.succeeded, w.runs)}</TableCell>
                    <TableCell className="text-right tabular">{formatUsdMicros(w.costMicros)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent failed runs</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.failed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failed runs in this period.</p>
          ) : (
            <ul className="divide-y">
              {stats.failed.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="destructive">{r.errorCategory}</Badge>
                      <Badge variant="outline">{r.feature}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{r.model}</span>
                      {r.workspace ? (
                        <Link href={`/super-admin/workspaces/${r.workspace.id}`} className="text-xs hover:underline">
                          {r.workspace.name}
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 break-words text-sm">{r.errorMessage ?? "No message recorded."}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(r.startedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
