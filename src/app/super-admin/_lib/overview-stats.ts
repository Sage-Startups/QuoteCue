import "server-only";
import { prisma, Prisma } from "@/lib/db";
import { resolveDateRange } from "@/lib/utils/dates";

export interface PlatformBundle {
  newUsers: number;
  verifiedUsers: number;
  activeUsers: number;
  newWorkspaces: number;
  trialToPaidPercent: number;
  cancelled: number;
  churnPercent: number;
  creditPacksSold: number;
  creditPackRevenueMinor: number;
  quotesCreated: number;
  quotesSent: number;
  quotesViewed: number;
  quotesAccepted: number;
  acceptanceRate: number;
  aiRuns: number;
  aiSucceeded: number;
  aiFailed: number;
  aiCostMicros: number;
  emailsSent: number;
  emailsFailed: number;
}

export interface PlatformSnapshot {
  totalUsers: number;
  verifiedTotal: number;
  suspendedUsers: number;
  totalWorkspaces: number;
  activeTrials: number;
  activeSubscriptions: number;
  starterCount: number;
  proCount: number;
  pastDue: number;
  cancelledTotal: number;
  complimentary: number;
  mrrMinor: number;
  arrMinor: number;
  storageBytes: number;
  storageObjects: number;
  failedWebhooks: number;
  lastHeartbeatAt: Date | null;
}

export interface PlatformStats {
  range: ReturnType<typeof resolveDateRange>;
  excludeDemo: boolean;
  current: PlatformBundle;
  previous: PlatformBundle;
  snapshot: PlatformSnapshot;
  series: Array<{ day: string; users: number; workspaces: number; quotes: number; aiRuns: number; sent: number; accepted: number }>;
  recentErrors: Array<{ id: string; scope: string; message: string; createdAt: Date }>;
}

function wsFilter(excludeDemo: boolean): Prisma.WorkspaceWhereInput {
  return excludeDemo ? { isDemo: false } : {};
}

async function bundle(from: Date, to: Date, excludeDemo: boolean): Promise<PlatformBundle> {
  const between = { gte: from, lte: to };
  const ws = wsFilter(excludeDemo);
  const [newUsers, verifiedUsers, activeUsers, newWorkspaces, newWorkspaceSubs, cancelled, activeAtStart, packs, packPlan, quotesCreated, quotesSent, quotesViewed, quotesAccepted, aiRuns, aiSucceeded, aiFailed, aiCost, emailsSent, emailsFailed] = await Promise.all([
    prisma.user.count({ where: { createdAt: between, deletedAt: null } }),
    prisma.user.count({ where: { createdAt: between, deletedAt: null, emailVerified: true } }),
    prisma.user.count({ where: { lastLoginAt: between, deletedAt: null } }),
    prisma.workspace.count({ where: { ...ws, createdAt: between, deletedAt: null } }),
    prisma.subscription.count({ where: { workspace: { ...ws, createdAt: between, deletedAt: null }, status: "ACTIVE", plan: { kind: "SUBSCRIPTION", monthlyPriceMinor: { gt: 0 } } } }),
    prisma.subscription.count({ where: { workspace: ws, canceledAt: between, plan: { monthlyPriceMinor: { gt: 0 } } } }),
    prisma.subscription.count({ where: { workspace: ws, createdAt: { lt: from }, plan: { monthlyPriceMinor: { gt: 0 } }, OR: [{ status: "ACTIVE" }, { canceledAt: { gte: from } }] } }),
    prisma.creditLedgerEntry.count({ where: { workspace: ws, type: "PACK_PURCHASE", createdAt: between } }),
    prisma.plan.findFirst({ where: { kind: "CREDIT_PACK" }, orderBy: { sortOrder: "asc" }, select: { oneTimePriceMinor: true } }),
    prisma.quote.count({ where: { workspace: ws, deletedAt: null, createdAt: between } }),
    prisma.quote.count({ where: { workspace: ws, deletedAt: null, sentAt: between } }),
    prisma.quote.count({ where: { workspace: ws, deletedAt: null, firstViewedAt: between } }),
    prisma.quote.count({ where: { workspace: ws, deletedAt: null, acceptedAt: between } }),
    prisma.aiRun.count({ where: { startedAt: between, feature: { not: "PROMPT_TEST" }, ...(excludeDemo ? { OR: [{ workspaceId: null }, { workspace: { isDemo: false } }] } : {}) } }),
    prisma.aiRun.count({ where: { startedAt: between, status: "SUCCEEDED", feature: { not: "PROMPT_TEST" }, ...(excludeDemo ? { OR: [{ workspaceId: null }, { workspace: { isDemo: false } }] } : {}) } }),
    prisma.aiRun.count({ where: { startedAt: between, status: "FAILED", feature: { not: "PROMPT_TEST" }, ...(excludeDemo ? { OR: [{ workspaceId: null }, { workspace: { isDemo: false } }] } : {}) } }),
    prisma.aiRun.aggregate({ where: { startedAt: between, ...(excludeDemo ? { OR: [{ workspaceId: null }, { workspace: { isDemo: false } }] } : {}) }, _sum: { estimatedCostMicros: true } }),
    prisma.emailEvent.count({ where: { createdAt: between, status: { in: ["SENT", "DELIVERED"] } } }),
    prisma.emailEvent.count({ where: { createdAt: between, status: "FAILED" } }),
  ]);
  return {
    newUsers,
    verifiedUsers,
    activeUsers,
    newWorkspaces,
    trialToPaidPercent: newWorkspaces > 0 ? Math.round((newWorkspaceSubs / newWorkspaces) * 100) : 0,
    cancelled,
    churnPercent: activeAtStart > 0 ? Math.round((cancelled / activeAtStart) * 1000) / 10 : 0,
    creditPacksSold: packs,
    creditPackRevenueMinor: packs * (packPlan?.oneTimePriceMinor ?? 0),
    quotesCreated,
    quotesSent,
    quotesViewed,
    quotesAccepted,
    acceptanceRate: quotesSent > 0 ? Math.round((quotesAccepted / quotesSent) * 100) : 0,
    aiRuns,
    aiSucceeded,
    aiFailed,
    aiCostMicros: aiCost._sum.estimatedCostMicros ?? 0,
    emailsSent,
    emailsFailed,
  };
}

async function snapshot(excludeDemo: boolean): Promise<PlatformSnapshot> {
  const ws = wsFilter(excludeDemo);
  const [totalUsers, verifiedTotal, suspendedUsers, totalWorkspaces, activeTrials, subs, storage, failedWebhooks, heartbeat] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, emailVerified: true } }),
    prisma.user.count({ where: { deletedAt: null, suspendedAt: { not: null } } }),
    prisma.workspace.count({ where: { ...ws, deletedAt: null } }),
    prisma.subscription.count({ where: { workspace: ws, status: "TRIALING", plan: { key: "FREE" } } }),
    prisma.subscription.findMany({ where: { workspace: ws, plan: { kind: "SUBSCRIPTION" } }, select: { status: true, interval: true, plan: { select: { key: true, monthlyPriceMinor: true, annualPriceMinor: true } } } }),
    prisma.storedObject.aggregate({ where: { deletedAt: null, ...(excludeDemo ? { OR: [{ workspaceId: null }, { workspace: { isDemo: false } }] } : {}) }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.stripeWebhookEvent.count({ where: { status: "FAILED" } }),
    prisma.backgroundJobRun.findFirst({ where: { jobName: "heartbeat", status: "SUCCEEDED" }, orderBy: { startedAt: "desc" }, select: { finishedAt: true, startedAt: true } }),
  ]);
  let mrr = 0;
  let activeSubscriptions = 0;
  let starterCount = 0;
  let proCount = 0;
  let pastDue = 0;
  let cancelledTotal = 0;
  let complimentary = 0;
  for (const s of subs) {
    if (s.status === "PAST_DUE") pastDue++;
    if (s.status === "CANCELED") cancelledTotal++;
    if (s.status === "COMPLIMENTARY") complimentary++;
    if (s.status === "ACTIVE" && s.plan.monthlyPriceMinor > 0) {
      activeSubscriptions++;
      if (s.plan.key === "STARTER") starterCount++;
      if (s.plan.key === "PRO") proCount++;
      mrr += s.interval === "YEAR" ? Math.round(s.plan.annualPriceMinor / 12) : s.plan.monthlyPriceMinor;
    }
  }
  return {
    totalUsers,
    verifiedTotal,
    suspendedUsers,
    totalWorkspaces,
    activeTrials,
    activeSubscriptions,
    starterCount,
    proCount,
    pastDue,
    cancelledTotal,
    complimentary,
    mrrMinor: mrr,
    arrMinor: mrr * 12,
    storageBytes: storage._sum.sizeBytes ?? 0,
    storageObjects: storage._count._all,
    failedWebhooks,
    lastHeartbeatAt: heartbeat?.finishedAt ?? heartbeat?.startedAt ?? null,
  };
}

export async function getPlatformStats(rangeKey: string | undefined, from: string | undefined, to: string | undefined, excludeDemo: boolean): Promise<PlatformStats> {
  const range = resolveDateRange(rangeKey, from, to);
  const demoSql = excludeDemo ? Prisma.sql`AND w."isDemo" = false` : Prisma.empty;
  const aiDemoSql = excludeDemo ? Prisma.sql`AND (w.id IS NULL OR w."isDemo" = false)` : Prisma.empty;
  const [current, previous, snap, seriesRows, recentErrors] = await Promise.all([
    bundle(range.from, range.to, excludeDemo),
    bundle(range.previousFrom, range.previousTo, excludeDemo),
    snapshot(excludeDemo),
    prisma.$queryRaw<Array<{ day: Date; users: number; workspaces: number; quotes: number; ai_runs: number; sent: number; accepted: number }>>`
      WITH days AS (
        SELECT generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date AS day
      )
      SELECT d.day,
        COALESCE((SELECT COUNT(*) FROM "user" u WHERE u."createdAt"::date = d.day AND u."deletedAt" IS NULL), 0)::int AS users,
        COALESCE((SELECT COUNT(*) FROM "Workspace" w WHERE w."createdAt"::date = d.day AND w."deletedAt" IS NULL ${demoSql}), 0)::int AS workspaces,
        COALESCE((SELECT COUNT(*) FROM "Quote" q JOIN "Workspace" w ON w.id = q."workspaceId" WHERE q."createdAt"::date = d.day AND q."deletedAt" IS NULL ${demoSql}), 0)::int AS quotes,
        COALESCE((SELECT COUNT(*) FROM "Quote" q JOIN "Workspace" w ON w.id = q."workspaceId" WHERE q."sentAt"::date = d.day AND q."deletedAt" IS NULL ${demoSql}), 0)::int AS sent,
        COALESCE((SELECT COUNT(*) FROM "Quote" q JOIN "Workspace" w ON w.id = q."workspaceId" WHERE q."acceptedAt"::date = d.day AND q."deletedAt" IS NULL ${demoSql}), 0)::int AS accepted,
        COALESCE((SELECT COUNT(*) FROM "AiRun" r LEFT JOIN "Workspace" w ON w.id = r."workspaceId" WHERE r."startedAt"::date = d.day AND r.feature <> 'PROMPT_TEST' ${aiDemoSql}), 0)::int AS ai_runs
      FROM days d ORDER BY d.day
    `,
    prisma.applicationError.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, scope: true, message: true, createdAt: true } }),
  ]);
  return {
    range,
    excludeDemo,
    current,
    previous,
    snapshot: snap,
    series: seriesRows.map((r) => ({ day: new Date(r.day).toISOString().slice(0, 10), users: r.users, workspaces: r.workspaces, quotes: r.quotes, aiRuns: r.ai_runs, sent: r.sent, accepted: r.accepted })),
    recentErrors,
  };
}
