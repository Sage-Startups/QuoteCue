import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw, ExternalLink } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getStorage } from "@/lib/storage";
import { getAiProvider } from "@/lib/ai";
import { getEmailProvider } from "@/lib/email";
import { stripeHealthCheck } from "@/lib/billing/stripe";
import { formatDateTime, formatRelative } from "@/lib/utils/dates";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JsonBlock } from "@/components/admin/misc";
import { hoursSince, timeAgo } from "@/components/admin/format";

export const metadata: Metadata = { title: "System health" };
export const dynamic = "force-dynamic";

interface Check {
  name: string;
  ok: boolean;
  warn?: boolean;
  message: string;
  latencyMs: number;
  mode: string;
}

async function timed(name: string, mode: string, fn: () => Promise<{ ok: boolean; message: string; warn?: boolean }>): Promise<Check> {
  const started = Date.now();
  try {
    const result = await fn();
    return { name, mode, ...result, latencyMs: Date.now() - started };
  } catch (error) {
    return { name, mode, ok: false, message: (error as Error).message, latencyMs: Date.now() - started };
  }
}

export default async function SystemHealthPage() {
  await requireSuperAdminForPage("/super-admin/system-health");
  const env = getEnv();
  const [database, storage, stripe, openai, email, cron, errors, errorCounts] = await Promise.all([
    timed("Database", "postgresql", async () => {
      await prisma.$queryRaw`SELECT 1`;
      const migrations = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL`;
      return { ok: true, message: `Connected; ${Number(migrations[0]?.count ?? 0)} migrations applied` };
    }),
    timed("Storage", env.providers.storage, () => getStorage().healthCheck()),
    timed("Stripe", env.providers.stripe, async () => {
      const r = await stripeHealthCheck();
      return env.providers.stripe === "mock" ? { ok: false, warn: true, message: r.message } : r;
    }),
    timed("OpenAI", env.providers.ai, async () => {
      const r = await getAiProvider().healthCheck();
      return env.providers.ai === "mock" ? { ...r, ok: r.ok, warn: true } : r;
    }),
    timed("Email (Resend)", env.providers.email, async () => {
      const r = await getEmailProvider().healthCheck();
      return env.providers.email === "preview" ? { ...r, warn: true } : r;
    }),
    timed("Cron heartbeat", "background jobs", async () => {
      const last = await prisma.backgroundJobRun.findFirst({ where: { jobName: "heartbeat", status: "SUCCEEDED" }, orderBy: { startedAt: "desc" } });
      const at = last?.finishedAt ?? last?.startedAt ?? null;
      const hours = hoursSince(at);
      if (!at || hours === null) return { ok: false, message: "No cron heartbeat recorded yet" };
      return { ok: hours <= 26, message: `Last heartbeat ${formatRelative(at)} (${formatDateTime(at)})` };
    }),
    prisma.applicationError.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    Promise.all([prisma.applicationError.count({ where: { createdAt: { gte: timeAgo(86_400_000) } } }), prisma.applicationError.count({ where: { createdAt: { gte: timeAgo(7 * 86_400_000) } } }), prisma.applicationError.count()]),
  ]);
  const checks = [database, storage, stripe, openai, email, cron];
  const critical = checks.filter((c) => !c.ok && !c.warn);
  const [errors24h, errors7d, errorsTotal] = errorCounts;
  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        description={`Checked ${formatDateTime(new Date())} · environment ${env.NODE_ENV}`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/super-admin/system-health">
                <RefreshCw /> Re-run checks
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="/api/health/system" target="_blank" rel="noopener noreferrer">
                <ExternalLink /> JSON endpoint
              </a>
            </Button>
          </>
        }
      />
      {critical.length > 0 ? (
        <Alert variant="destructive" title={`${critical.length} check${critical.length === 1 ? "" : "s"} failing`}>
          {critical.map((c) => c.name).join(", ")}
        </Alert>
      ) : (
        <Alert variant="success" title="Core services healthy">
          Database and storage are reachable.
        </Alert>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((c) => (
          <div key={c.name} className="rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{c.name}</p>
              <Badge variant={c.ok ? "success" : c.warn ? "warning" : "destructive"}>{c.ok ? "OK" : c.warn ? "Mock / preview" : "Failing"}</Badge>
            </div>
            <p className="mt-1 break-words text-sm text-muted-foreground">{c.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Mode: <span className="font-mono">{c.mode}</span> · {c.latencyMs} ms
            </p>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Provider modes</CardTitle>
          <CardDescription>Derived from the environment. Secrets are never displayed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(env.providers).map(([k, v]) => (
              <Badge key={k} variant={v === "mock" || v === "preview" || v === "local" || v === "memory" ? "warning" : "success"}>
                {k}: {v}
              </Badge>
            ))}
            <Badge variant="outline">APP_URL: {env.APP_URL}</Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Application errors</CardTitle>
          <CardDescription>
            {errors24h} in the last 24 hours · {errors7d} in 7 days · {errorsTotal} total. Showing the 20 most recent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No application errors recorded.</p>
          ) : (
            <ul className="divide-y">
              {errors.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Badge variant="outline">{e.scope}</Badge>
                      <p className="mt-1 break-words text-sm">{e.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                  </div>
                  {e.stack || e.metadata ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Details</summary>
                      <div className="mt-2 space-y-2">
                        {e.metadata ? <JsonBlock value={e.metadata} maxHeight="10rem" /> : null}
                        {e.stack ? <JsonBlock value={e.stack} maxHeight="14rem" /> : null}
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
