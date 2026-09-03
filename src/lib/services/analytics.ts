import { prisma, Prisma } from "@/lib/db";
import { resolveDateRange } from "@/lib/utils/dates";

export interface WorkspaceStats {
  range: ReturnType<typeof resolveDateRange>;
  current: StatBundle;
  previous: StatBundle;
  series: Array<{ day: string; created: number; sent: number; accepted: number; valueQuotedMinor: number; valueAcceptedMinor: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  recentActivity: Array<{ id: string; type: string; quoteId: string; quoteNumber: string; quoteTitle: string; message: string | null; createdAt: Date; actorName: string | null }>;
}

export interface StatBundle {
  quotesCreated: number;
  quotesSent: number;
  quotesViewed: number;
  quotesAccepted: number;
  quotesDeclined: number;
  acceptanceRate: number;
  totalQuotedMinor: number;
  totalAcceptedMinor: number;
  averageQuoteMinor: number;
  averageCreateToSendHours: number | null;
  aiGenerations: number;
}

async function bundle(workspaceId: string, from: Date, to: Date): Promise<StatBundle> {
  const [created, sent, viewed, accepted, declined, quotedAgg, acceptedAgg, ai, sendTimes] = await Promise.all([
    prisma.quote.count({ where: { workspaceId, deletedAt: null, createdAt: { gte: from, lte: to } } }),
    prisma.quote.count({ where: { workspaceId, deletedAt: null, sentAt: { gte: from, lte: to } } }),
    prisma.quote.count({ where: { workspaceId, deletedAt: null, firstViewedAt: { gte: from, lte: to } } }),
    prisma.quote.count({ where: { workspaceId, deletedAt: null, acceptedAt: { gte: from, lte: to } } }),
    prisma.quote.count({ where: { workspaceId, deletedAt: null, declinedAt: { gte: from, lte: to } } }),
    prisma.quote.aggregate({ where: { workspaceId, deletedAt: null, sentAt: { gte: from, lte: to } }, _sum: { totalMinor: true }, _avg: { totalMinor: true } }),
    prisma.quote.aggregate({ where: { workspaceId, deletedAt: null, acceptedAt: { gte: from, lte: to } }, _sum: { totalMinor: true } }),
    prisma.aiRun.count({ where: { workspaceId, status: "SUCCEEDED", feature: { in: ["ENQUIRY_ANALYSIS", "QUOTE_WORDING"] }, startedAt: { gte: from, lte: to } } }),
    prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("sentAt" - "createdAt")) / 3600.0)::float AS avg_hours
      FROM "Quote" WHERE "workspaceId" = ${workspaceId}::uuid AND "deletedAt" IS NULL AND "sentAt" IS NOT NULL AND "sentAt" >= ${from} AND "sentAt" <= ${to}
    `,
  ]);
  const decided = accepted + declined;
  return {
    quotesCreated: created,
    quotesSent: sent,
    quotesViewed: viewed,
    quotesAccepted: accepted,
    quotesDeclined: declined,
    acceptanceRate: sent > 0 ? Math.round((accepted / sent) * 100) : decided > 0 ? Math.round((accepted / decided) * 100) : 0,
    totalQuotedMinor: quotedAgg._sum.totalMinor ?? 0,
    totalAcceptedMinor: acceptedAgg._sum.totalMinor ?? 0,
    averageQuoteMinor: Math.round(quotedAgg._avg.totalMinor ?? 0),
    averageCreateToSendHours: sendTimes[0]?.avg_hours ?? null,
    aiGenerations: ai,
  };
}

export async function getWorkspaceStats(workspaceId: string, rangeKey?: string, from?: string | null, to?: string | null): Promise<WorkspaceStats> {
  const range = resolveDateRange(rangeKey, from, to);
  const [current, previous, seriesRows, statusRows, activity] = await Promise.all([
    bundle(workspaceId, range.from, range.to),
    bundle(workspaceId, range.previousFrom, range.previousTo),
    prisma.$queryRaw<Array<{ day: Date; created: number; sent: number; accepted: number; value_quoted: number; value_accepted: number }>>`
      WITH days AS (
        SELECT generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date AS day
      )
      SELECT d.day,
        COALESCE((SELECT COUNT(*) FROM "Quote" q WHERE q."workspaceId" = ${workspaceId}::uuid AND q."deletedAt" IS NULL AND q."createdAt"::date = d.day), 0)::int AS created,
        COALESCE((SELECT COUNT(*) FROM "Quote" q WHERE q."workspaceId" = ${workspaceId}::uuid AND q."deletedAt" IS NULL AND q."sentAt"::date = d.day), 0)::int AS sent,
        COALESCE((SELECT COUNT(*) FROM "Quote" q WHERE q."workspaceId" = ${workspaceId}::uuid AND q."deletedAt" IS NULL AND q."acceptedAt"::date = d.day), 0)::int AS accepted,
        COALESCE((SELECT SUM(q."totalMinor") FROM "Quote" q WHERE q."workspaceId" = ${workspaceId}::uuid AND q."deletedAt" IS NULL AND q."sentAt"::date = d.day), 0)::int AS value_quoted,
        COALESCE((SELECT SUM(q."totalMinor") FROM "Quote" q WHERE q."workspaceId" = ${workspaceId}::uuid AND q."deletedAt" IS NULL AND q."acceptedAt"::date = d.day), 0)::int AS value_accepted
      FROM days d ORDER BY d.day
    `,
    prisma.quote.groupBy({ by: ["status"], where: { workspaceId, deletedAt: null }, _count: { _all: true } }),
    prisma.quoteEvent.findMany({
      where: { workspaceId, createdAt: { gte: range.from, lte: range.to }, type: { notIn: ["UPDATED", "VIEW_REPEAT", "LINK_COPIED"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { quote: { select: { number: true, title: true } }, actorUser: { select: { name: true } } },
    }),
  ]);
  return {
    range,
    current,
    previous,
    series: seriesRows.map((r) => ({
      day: new Date(r.day).toISOString().slice(0, 10),
      created: r.created,
      sent: r.sent,
      accepted: r.accepted,
      valueQuotedMinor: r.value_quoted,
      valueAcceptedMinor: r.value_accepted,
    })),
    statusBreakdown: statusRows.map((s) => ({ status: s.status, count: s._count._all })),
    recentActivity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      quoteId: a.quoteId,
      quoteNumber: a.quote.number,
      quoteTitle: a.quote.title,
      message: a.message,
      createdAt: a.createdAt,
      actorName: a.actorUser?.name ?? null,
    })),
  };
}

export function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

/** Aggregates daily statistics into WorkspaceDailyStat rows (idempotent upsert). */
export async function aggregateDailyStats(day: Date): Promise<number> {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000 - 1);
  const workspaces = await prisma.workspace.findMany({ where: { deletedAt: null }, select: { id: true } });
  let count = 0;
  for (const ws of workspaces) {
    const b = await bundle(ws.id, start, end);
    await prisma.workspaceDailyStat.upsert({
      where: { workspaceId_day: { workspaceId: ws.id, day: start } },
      create: {
        workspaceId: ws.id,
        day: start,
        quotesCreated: b.quotesCreated,
        quotesSent: b.quotesSent,
        quotesViewed: b.quotesViewed,
        quotesAccepted: b.quotesAccepted,
        quotesDeclined: b.quotesDeclined,
        valueQuotedMinor: b.totalQuotedMinor,
        valueAcceptedMinor: b.totalAcceptedMinor,
        aiGenerations: b.aiGenerations,
      },
      update: {
        quotesCreated: b.quotesCreated,
        quotesSent: b.quotesSent,
        quotesViewed: b.quotesViewed,
        quotesAccepted: b.quotesAccepted,
        quotesDeclined: b.quotesDeclined,
        valueQuotedMinor: b.totalQuotedMinor,
        valueAcceptedMinor: b.totalAcceptedMinor,
        aiGenerations: b.aiGenerations,
      },
    });
    count++;
  }
  return count;
}

export type { Prisma };
