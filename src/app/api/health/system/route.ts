import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getStorage } from "@/lib/storage";
import { getAiProvider } from "@/lib/ai";
import { getEmailProvider } from "@/lib/email";
import { stripeHealthCheck } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

/** Deep system health check. Super admins only; never exposes secrets. */
export async function GET() {
  const session = await getSessionContext();
  if (!session || session.user.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const env = getEnv();
  const started = Date.now();
  const time = async <T,>(fn: () => Promise<T>) => {
    const t = Date.now();
    try {
      const value = await fn();
      return { ...value, latencyMs: Date.now() - t } as T & { latencyMs: number };
    } catch (error) {
      return { ok: false, message: (error as Error).message, latencyMs: Date.now() - t } as unknown as T & { latencyMs: number };
    }
  };
  const [database, storage, stripe, openai, email, heartbeat] = await Promise.all([
    time(async () => {
      await prisma.$queryRaw`SELECT 1`;
      const migrations = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL`;
      return { ok: true, message: `Connected; ${Number(migrations[0]?.count ?? 0)} migrations applied` };
    }),
    time(() => getStorage().healthCheck()),
    time(() => stripeHealthCheck()),
    time(() => getAiProvider().healthCheck()),
    time(() => getEmailProvider().healthCheck()),
    time(async () => {
      const last = await prisma.backgroundJobRun.findFirst({ where: { jobName: "heartbeat", status: "SUCCEEDED" }, orderBy: { startedAt: "desc" } });
      const ageMs = last ? Date.now() - last.startedAt.getTime() : null;
      return { ok: ageMs !== null && ageMs < 26 * 3_600_000, message: last ? `Last heartbeat ${Math.round((ageMs ?? 0) / 60_000)} minutes ago` : "No cron heartbeat recorded yet" };
    }),
  ]);
  return NextResponse.json(
    {
      status: [database, storage].every((c) => c.ok) ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      totalLatencyMs: Date.now() - started,
      providers: env.providers,
      checks: { database, storage, stripe, openai, email, cron: heartbeat },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
