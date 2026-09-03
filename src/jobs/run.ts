import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { prisma, disconnectPrisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { JOBS, type JobDefinition } from "./registry";

/**
 * Standalone job runner for Railway Cron. Acquires a PostgreSQL advisory lock
 * so overlapping runs are skipped, records every job in BackgroundJobRun, and
 * exits with a non-zero code if any job fails.
 *
 * Usage: pnpm jobs:run [--only job-name] [--list]
 */
const LOCK_KEY = 7_420_261; // arbitrary constant shared by all runners

async function withAdvisoryLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`;
  if (!rows[0]?.locked) return null;
  try {
    return await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY})`;
  }
}

async function runJob(job: JobDefinition, runId: string, now: Date): Promise<boolean> {
  const started = Date.now();
  const record = await prisma.backgroundJobRun.create({ data: { runId, jobName: job.name, status: "RUNNING", host: hostname() } });
  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(message);
    console.log(`[jobs] ${job.name}: ${message}`);
  };
  try {
    const result = await job.run({ now, log });
    await prisma.backgroundJobRun.update({ where: { id: record.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), durationMs: Date.now() - started, result: JSON.parse(JSON.stringify({ ...result, logs })) } });
    console.log(`[jobs] ${job.name}: ok (${Date.now() - started} ms)`, result);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.backgroundJobRun.update({ where: { id: record.id }, data: { status: "FAILED", finishedAt: new Date(), durationMs: Date.now() - started, error: message.slice(0, 4000), result: { logs } } }).catch(() => undefined);
    console.error(`[jobs] ${job.name}: FAILED`, error);
    return false;
  }
}

export async function runAllJobs(options: { only?: string[]; now?: Date } = {}): Promise<{ ran: number; failed: number; skipped: boolean }> {
  const now = options.now ?? new Date();
  const runId = randomUUID();
  const selected = options.only && options.only.length > 0 ? JOBS.filter((j) => options.only!.includes(j.name)) : JOBS;
  const outcome = await withAdvisoryLock(async () => {
    let failed = 0;
    for (const job of selected) {
      const ok = await runJob(job, runId, now);
      if (!ok) failed++;
    }
    return { ran: selected.length, failed };
  });
  if (!outcome) {
    await prisma.backgroundJobRun.create({ data: { runId, jobName: "runner", status: "SKIPPED", host: hostname(), finishedAt: new Date(), error: "Another runner holds the advisory lock" } });
    console.warn("[jobs] another runner is active; skipping this run");
    return { ran: 0, failed: 0, skipped: true };
  }
  return { ...outcome, skipped: false };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    for (const job of JOBS) console.log(`${job.name.padEnd(28)} ${job.description}`);
    return;
  }
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.split(",") : undefined;
  const env = getEnv();
  console.log(`[jobs] starting (${env.NODE_ENV}, storage=${env.providers.storage}, email=${env.providers.email})`);
  const shutdown = () => {
    console.warn("[jobs] received termination signal, finishing current job before exit");
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  const result = await runAllJobs({ only });
  console.log(`[jobs] finished: ${result.ran} ran, ${result.failed} failed${result.skipped ? ", skipped (locked)" : ""}`);
  if (result.failed > 0) process.exitCode = 1;
}

const isDirectRun = process.argv[1]?.endsWith("run.ts") || process.argv[1]?.endsWith("run.js") || process.argv[1]?.endsWith("run.mjs");
if (isDirectRun) {
  main()
    .catch((error) => {
      console.error("[jobs] fatal", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
