import "server-only";
import { prisma, Prisma } from "@/lib/db";
import { resolveDateRange } from "@/lib/utils/dates";

export interface AiUsageStats {
  range: ReturnType<typeof resolveDateRange>;
  totals: { runs: number; succeeded: number; failed: number; running: number; inputTokens: number; outputTokens: number; audioSeconds: number; costMicros: number; generationSuccesses: number };
  byFeature: Array<{ feature: string; runs: number; succeeded: number; failed: number; costMicros: number; inputTokens: number; outputTokens: number }>;
  byModel: Array<{ model: string; provider: string; runs: number; succeeded: number; costMicros: number; inputTokens: number; outputTokens: number }>;
  byWorkspace: Array<{ workspaceId: string; name: string; isDemo: boolean; runs: number; succeeded: number; costMicros: number }>;
  failed: Array<{ id: string; feature: string; errorCategory: string; errorMessage: string | null; workspace: { id: string; name: string } | null; startedAt: Date; model: string }>;
  series: Array<{ day: string; runs: number; failed: number; costMicros: number }>;
}

export function aiRunWhere(from: Date, to: Date, excludeDemo: boolean): Prisma.AiRunWhereInput {
  return { startedAt: { gte: from, lte: to }, ...(excludeDemo ? { OR: [{ workspaceId: null }, { workspace: { isDemo: false } }] } : {}) };
}

export async function getAiUsageStats(rangeKey: string | undefined, from: string | undefined, to: string | undefined, excludeDemo: boolean): Promise<AiUsageStats> {
  const range = resolveDateRange(rangeKey, from, to);
  const where = aiRunWhere(range.from, range.to, excludeDemo);
  const demoSql = excludeDemo ? Prisma.sql`AND (w.id IS NULL OR w."isDemo" = false)` : Prisma.empty;
  const [agg, byStatus, generationSuccesses, featureRows, modelRows, workspaceRows, failed, seriesRows] = await Promise.all([
    prisma.aiRun.aggregate({ where, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, audioSeconds: true, estimatedCostMicros: true } }),
    prisma.aiRun.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.aiRun.count({ where: { ...where, status: "SUCCEEDED", feature: { in: ["ENQUIRY_ANALYSIS", "QUOTE_WORDING"] } } }),
    prisma.aiRun.groupBy({ by: ["feature", "status"], where, _count: { _all: true }, _sum: { estimatedCostMicros: true, inputTokens: true, outputTokens: true } }),
    prisma.aiRun.groupBy({ by: ["model", "provider", "status"], where, _count: { _all: true }, _sum: { estimatedCostMicros: true, inputTokens: true, outputTokens: true } }),
    prisma.aiRun.groupBy({ by: ["workspaceId", "status"], where: { ...where, workspaceId: { not: null } }, _count: { _all: true }, _sum: { estimatedCostMicros: true } }),
    prisma.aiRun.findMany({ where: { ...where, status: "FAILED" }, orderBy: { startedAt: "desc" }, take: 25, select: { id: true, feature: true, errorCategory: true, errorMessage: true, startedAt: true, model: true, workspace: { select: { id: true, name: true } } } }),
    prisma.$queryRaw<Array<{ day: Date; runs: number; failed: number; cost: number }>>`
      WITH days AS (SELECT generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date AS day)
      SELECT d.day,
        COALESCE((SELECT COUNT(*) FROM "AiRun" r LEFT JOIN "Workspace" w ON w.id = r."workspaceId" WHERE r."startedAt"::date = d.day ${demoSql}), 0)::int AS runs,
        COALESCE((SELECT COUNT(*) FROM "AiRun" r LEFT JOIN "Workspace" w ON w.id = r."workspaceId" WHERE r."startedAt"::date = d.day AND r.status = 'FAILED' ${demoSql}), 0)::int AS failed,
        COALESCE((SELECT SUM(r."estimatedCostMicros") FROM "AiRun" r LEFT JOIN "Workspace" w ON w.id = r."workspaceId" WHERE r."startedAt"::date = d.day ${demoSql}), 0)::bigint AS cost
      FROM days d ORDER BY d.day
    `,
  ]);
  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;

  const features = new Map<string, AiUsageStats["byFeature"][number]>();
  for (const r of featureRows) {
    const f = features.get(r.feature) ?? { feature: r.feature, runs: 0, succeeded: 0, failed: 0, costMicros: 0, inputTokens: 0, outputTokens: 0 };
    f.runs += r._count._all;
    if (r.status === "SUCCEEDED") f.succeeded += r._count._all;
    if (r.status === "FAILED") f.failed += r._count._all;
    f.costMicros += r._sum.estimatedCostMicros ?? 0;
    f.inputTokens += r._sum.inputTokens ?? 0;
    f.outputTokens += r._sum.outputTokens ?? 0;
    features.set(r.feature, f);
  }
  const models = new Map<string, AiUsageStats["byModel"][number]>();
  for (const r of modelRows) {
    const key = `${r.provider}:${r.model}`;
    const m = models.get(key) ?? { model: r.model, provider: r.provider, runs: 0, succeeded: 0, costMicros: 0, inputTokens: 0, outputTokens: 0 };
    m.runs += r._count._all;
    if (r.status === "SUCCEEDED") m.succeeded += r._count._all;
    m.costMicros += r._sum.estimatedCostMicros ?? 0;
    m.inputTokens += r._sum.inputTokens ?? 0;
    m.outputTokens += r._sum.outputTokens ?? 0;
    models.set(key, m);
  }
  const wsMap = new Map<string, { runs: number; succeeded: number; costMicros: number }>();
  for (const r of workspaceRows) {
    if (!r.workspaceId) continue;
    const w = wsMap.get(r.workspaceId) ?? { runs: 0, succeeded: 0, costMicros: 0 };
    w.runs += r._count._all;
    if (r.status === "SUCCEEDED") w.succeeded += r._count._all;
    w.costMicros += r._sum.estimatedCostMicros ?? 0;
    wsMap.set(r.workspaceId, w);
  }
  const topIds = [...wsMap.entries()].sort((a, b) => b[1].runs - a[1].runs).slice(0, 20);
  const wsRows = topIds.length > 0 ? await prisma.workspace.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, name: true, isDemo: true } }) : [];
  const byWorkspace = topIds.map(([id, v]) => {
    const w = wsRows.find((x) => x.id === id);
    return { workspaceId: id, name: w?.name ?? "Deleted workspace", isDemo: w?.isDemo ?? false, ...v };
  });

  return {
    range,
    totals: {
      runs: agg._count._all,
      succeeded: statusCount("SUCCEEDED"),
      failed: statusCount("FAILED"),
      running: statusCount("RUNNING"),
      inputTokens: agg._sum.inputTokens ?? 0,
      outputTokens: agg._sum.outputTokens ?? 0,
      audioSeconds: agg._sum.audioSeconds ?? 0,
      costMicros: agg._sum.estimatedCostMicros ?? 0,
      generationSuccesses,
    },
    byFeature: [...features.values()].sort((a, b) => b.runs - a.runs),
    byModel: [...models.values()].sort((a, b) => b.runs - a.runs),
    byWorkspace,
    failed,
    series: seriesRows.map((r) => ({ day: new Date(r.day).toISOString().slice(0, 10), runs: r.runs, failed: r.failed, costMicros: Number(r.cost) })),
  };
}
