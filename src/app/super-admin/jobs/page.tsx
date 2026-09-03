import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma, type Prisma } from "@/lib/db";
import { formatDateTime, formatRelative } from "@/lib/utils/dates";
import { PageHeader, Alert, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { JsonBlock } from "@/components/admin/misc";
import { JobStatusBadge } from "@/components/admin/badges";
import { formatDurationMs, hoursSince } from "@/components/admin/format";
import { PAGE_SIZE, enumParam, pageCount, parsePage } from "../_lib/admin";

export const metadata: Metadata = { title: "Background jobs" };

const STATUSES = ["RUNNING", "SUCCEEDED", "FAILED", "SKIPPED"] as const;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ q?: string; job?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/jobs");
  const page = parsePage(params.page);
  const jobNames = await prisma.backgroundJobRun.findMany({ distinct: ["jobName"], select: { jobName: true }, orderBy: { jobName: "asc" } });
  const where: Prisma.BackgroundJobRunWhereInput = {};
  const job = params.job && jobNames.some((j) => j.jobName === params.job) ? params.job : undefined;
  if (job) where.jobName = job;
  const status = enumParam(params.status, STATUSES);
  if (status) where.status = status;
  if (params.q) where.OR = [{ runId: { contains: params.q, mode: "insensitive" } }, { error: { contains: params.q, mode: "insensitive" } }, { host: { contains: params.q, mode: "insensitive" } }];
  const [total, runs, latest] = await Promise.all([
    prisma.backgroundJobRun.count({ where }),
    prisma.backgroundJobRun.findMany({ where, orderBy: { startedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    Promise.all(jobNames.map((j) => prisma.backgroundJobRun.findFirst({ where: { jobName: j.jobName }, orderBy: { startedAt: "desc" } }))),
  ]);
  const heartbeat = await prisma.backgroundJobRun.findFirst({ where: { jobName: "heartbeat", status: "SUCCEEDED" }, orderBy: { startedAt: "desc" } });
  const heartbeatAt = heartbeat?.finishedAt ?? heartbeat?.startedAt ?? null;
  const heartbeatHours = hoursSince(heartbeatAt);
  const stale = heartbeatHours === null || heartbeatHours > 26;
  const groups: Array<{ runId: string; runs: typeof runs }> = [];
  for (const r of runs) {
    const g = groups[groups.length - 1];
    if (g && g.runId === r.runId) g.runs.push(r);
    else groups.push({ runId: r.runId, runs: [r] });
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Background jobs" description="Scheduled maintenance runs recorded by the cron endpoint." />
      <Alert variant={stale ? "destructive" : "success"} title="Cron heartbeat">
        {heartbeatAt ? `Last successful heartbeat ${formatRelative(heartbeatAt)} (${formatDateTime(heartbeatAt)}).` : "No heartbeat has been recorded yet."} {stale ? "The scheduler appears to be stale (more than 26 hours). Check the cron configuration." : "The scheduler is running."}
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>Latest run per job.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobNames.length === 0 ? (
            <p className="text-sm text-muted-foreground">No job runs recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Last status</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Host</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobNames.map((j, i) => {
                  const last = latest[i];
                  return (
                    <TableRow key={j.jobName}>
                      <TableCell className="font-mono text-xs">{j.jobName}</TableCell>
                      <TableCell>{last ? <JobStatusBadge status={last.status} /> : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{last ? `${formatDateTime(last.startedAt)} (${formatRelative(last.startedAt)})` : "—"}</TableCell>
                      <TableCell className="text-right tabular text-sm">{formatDurationMs(last?.durationMs)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{last?.host ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <SearchForm
        placeholder="Search run id, host or error"
        query={params.q}
        filters={[
          { name: "job", label: "Job", value: params.job, options: [{ value: "", label: "All jobs" }, ...jobNames.map((j) => ({ value: j.jobName, label: j.jobName }))] },
          { name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))] },
        ]}
      />
      {runs.length === 0 ? (
        <EmptyState icon={Clock} title="No runs match" description="Try a different filter." />
      ) : (
        <>
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.runId} className="rounded-xl border bg-card shadow-card" aria-label={`Run ${g.runId}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
                  <p className="text-xs text-muted-foreground">
                    Run <span className="font-mono">{g.runId}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(g.runs[0]!.startedAt)}</p>
                </div>
                <ul className="divide-y">
                  {g.runs.map((r) => (
                    <li key={r.id} className="px-4 py-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <JobStatusBadge status={r.status} />
                          <span className="font-mono text-sm">{r.jobName}</span>
                          {r.host ? <Badge variant="muted">{r.host}</Badge> : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(r.startedAt)} · {formatDurationMs(r.durationMs)}
                        </span>
                      </div>
                      {r.error ? <p className="mt-1 break-words text-sm text-destructive">{r.error}</p> : null}
                      {r.result ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Result</summary>
                          <div className="mt-2">
                            <JsonBlock value={r.result} maxHeight="14rem" />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/jobs" params={{ q: params.q, job: params.job, status: params.status }} />
        </>
      )}
    </div>
  );
}
