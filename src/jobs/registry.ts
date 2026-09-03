import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSiteSettings } from "@/lib/config/site-settings";
import { sendEmail } from "@/lib/email";
import { getStorage } from "@/lib/storage";
import { cleanupRateLimitBuckets } from "@/lib/security/rate-limit";
import { aggregateDailyStats } from "@/lib/services/analytics";
import { addQuoteEvent } from "@/lib/services/quotes";
import { ensurePublicLink } from "@/lib/services/public-quote";
import { seedDemoWorkspace } from "@/lib/seed/demo";
import { formatMoney } from "@/lib/utils/money";
import { addDays, formatDate } from "@/lib/utils/dates";
import { customerDisplayName } from "@/lib/services/customers";

export interface JobContext {
  now: Date;
  log: (message: string) => void;
}

export interface JobDefinition {
  name: string;
  description: string;
  run: (ctx: JobContext) => Promise<Record<string, unknown>>;
}

/** Moves SENT/VIEWED quotes past their expiry date to EXPIRED. Idempotent. */
const expireOverdueQuotes: JobDefinition = {
  name: "expire-overdue-quotes",
  description: "Expire sent quotes whose expiry date has passed.",
  async run({ now }) {
    const overdue = await prisma.quote.findMany({ where: { status: { in: ["SENT", "VIEWED"] }, expiresAt: { lt: now }, deletedAt: null }, select: { id: true, workspaceId: true }, take: 500 });
    let expired = 0;
    for (const q of overdue) {
      const result = await prisma.quote.updateMany({ where: { id: q.id, status: { in: ["SENT", "VIEWED"] } }, data: { status: "EXPIRED", expiredAt: now } });
      if (result.count > 0) {
        await addQuoteEvent(prisma, { workspaceId: q.workspaceId, quoteId: q.id, type: "EXPIRED", actorType: "SYSTEM", message: "Quote expired automatically" });
        expired++;
      }
    }
    return { checked: overdue.length, expired };
  },
};

/** Emails customers a reminder a few days before a quote expires. Sends once per quote. */
const sendExpiryReminders: JobDefinition = {
  name: "send-expiry-reminders",
  description: "Send customers a reminder before their quote expires.",
  async run({ now, log }) {
    const settings = await getSiteSettings();
    const daysBefore = settings["email.quoteReminderDaysBefore"];
    const windowEnd = addDays(now, daysBefore);
    const due = await prisma.quote.findMany({
      where: { status: { in: ["SENT", "VIEWED"] }, deletedAt: null, reminderSentAt: null, expiresAt: { gt: now, lte: windowEnd }, customer: { email: { not: null } }, workspace: { status: "ACTIVE", isDemo: false } },
      include: { customer: true, workspace: { include: { settings: true } } },
      take: 200,
    });
    let sent = 0;
    for (const q of due) {
      if (!q.customer?.email) continue;
      const claimed = await prisma.quote.updateMany({ where: { id: q.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (claimed.count === 0) continue;
      const link = await ensurePublicLink(q.workspaceId, q.id);
      const outcome = await sendEmail({
        kind: "QUOTE_EXPIRY_REMINDER",
        to: q.customer.email,
        workspaceId: q.workspaceId,
        quoteId: q.id,
        variables: {
          customerName: q.customer.contactName,
          businessName: q.workspace.settings?.businessName ?? q.workspace.name,
          quoteNumber: q.number,
          quoteTitle: q.title,
          total: formatMoney(q.totalMinor, q.currency),
          expiryDate: formatDate(q.expiresAt),
          quoteUrl: link.url,
        },
      });
      await addQuoteEvent(prisma, { workspaceId: q.workspaceId, quoteId: q.id, type: "REMINDER_SENT", actorType: "SYSTEM", message: `Expiry reminder ${outcome.status === "FAILED" ? "failed" : "sent"} to ${customerDisplayName(q.customer)}` });
      sent++;
    }
    log(`Reminders sent: ${sent}`);
    return { candidates: due.length, sent };
  },
};

/** Marks pending uploads as expired and deletes their objects. */
const cleanExpiredUploads: JobDefinition = {
  name: "clean-expired-uploads",
  description: "Remove upload records and temporary files that were never completed.",
  async run({ now }) {
    const settings = await getSiteSettings();
    const cutoff = addDays(now, -settings["app.uploadRetentionDays"]);
    const stale = await prisma.upload.findMany({ where: { status: "PENDING", expiresAt: { lt: cutoff } }, select: { id: true, objectKey: true }, take: 500 });
    const storage = getStorage();
    let deleted = 0;
    for (const u of stale) {
      await storage.deleteObject(u.objectKey).catch(() => undefined);
      await prisma.upload.update({ where: { id: u.id }, data: { status: "EXPIRED" } });
      deleted++;
    }
    const removedRecords = await prisma.upload.deleteMany({ where: { status: { in: ["EXPIRED", "FAILED"] }, updatedAt: { lt: addDays(now, -30) } } });
    return { expired: deleted, purgedRecords: removedRecords.count };
  },
};

/** Deletes stored files for archived quotes older than the retention period and files already soft-deleted. */
const processRetention: JobDefinition = {
  name: "process-retention",
  description: "Apply data-retention rules to archived quote media and soft-deleted objects.",
  async run({ now }) {
    const settings = await getSiteSettings();
    const cutoff = addDays(now, -settings["app.dataRetentionDays"]);
    const storage = getStorage();
    const media = await prisma.quoteMedia.findMany({ where: { quote: { status: "ARCHIVED", archivedAt: { lt: cutoff } }, storedObject: { deletedAt: null } }, include: { storedObject: true }, take: 500 });
    let removed = 0;
    for (const m of media) {
      await storage.deleteObject(m.storedObject.key).catch(() => undefined);
      await prisma.storedObject.update({ where: { id: m.storedObjectId }, data: { deletedAt: now } });
      removed++;
    }
    const softDeleted = await prisma.storedObject.findMany({ where: { deletedAt: { lt: addDays(now, -7) } }, select: { id: true, key: true }, take: 500 });
    let purged = 0;
    for (const obj of softDeleted) {
      await storage.deleteObject(obj.key).catch(() => undefined);
      await prisma.storedObject.delete({ where: { id: obj.id } }).catch(() => undefined);
      purged++;
    }
    const deletedWorkspaces = await prisma.workspace.findMany({ where: { status: "PENDING_DELETION", deletionRequestedAt: { lt: addDays(now, -30) } }, select: { id: true } });
    for (const ws of deletedWorkspaces) {
      const { deleteWorkspaceCompletely } = await import("@/lib/services/account");
      await deleteWorkspaceCompletely(ws.id);
    }
    return { mediaRemoved: removed, objectsPurged: purged, workspacesDeleted: deletedWorkspaces.length };
  },
};

/** Aggregates yesterday's and today's statistics per workspace. */
const aggregateAnalytics: JobDefinition = {
  name: "aggregate-daily-analytics",
  description: "Aggregate daily quote statistics per workspace.",
  async run({ now }) {
    const yesterday = await aggregateDailyStats(addDays(now, -1));
    const today = await aggregateDailyStats(now);
    return { workspacesYesterday: yesterday, workspacesToday: today };
  },
};

/** Records storage usage per workspace and platform-wide. */
const recordStorageUsage: JobDefinition = {
  name: "record-storage-usage",
  description: "Snapshot storage usage per workspace.",
  async run({ now }) {
    const groups = await prisma.storedObject.groupBy({ by: ["workspaceId"], where: { deletedAt: null }, _sum: { sizeBytes: true }, _count: { _all: true } });
    let total = 0n;
    let count = 0;
    for (const g of groups) {
      const bytes = BigInt(g._sum.sizeBytes ?? 0);
      total += bytes;
      count += g._count._all;
      if (g.workspaceId) await prisma.storageUsageSnapshot.create({ data: { workspaceId: g.workspaceId, totalBytes: bytes, objectCount: g._count._all, recordedAt: now } });
    }
    await prisma.storageUsageSnapshot.create({ data: { workspaceId: null, totalBytes: total, objectCount: count, recordedAt: now } });
    await prisma.storageUsageSnapshot.deleteMany({ where: { recordedAt: { lt: addDays(now, -400) } } });
    return { workspaces: groups.length, totalBytes: Number(total), objects: count };
  },
};

/** Ends expired support sessions and cleans rate-limit buckets and old preview emails. */
const cleanupSessions: JobDefinition = {
  name: "cleanup-sessions",
  description: "Close expired support sessions, expired auth sessions and old rate-limit buckets.",
  async run({ now }) {
    const support = await prisma.supportSession.updateMany({ where: { endedAt: null, expiresAt: { lt: now } }, data: { endedAt: now } });
    const auth = await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
    const verification = await prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } });
    const buckets = await cleanupRateLimitBuckets(addDays(now, -1));
    const previews = await prisma.emailEvent.updateMany({ where: { status: "PREVIEW", createdAt: { lt: addDays(now, -14) }, htmlPreview: { not: null } }, data: { htmlPreview: null, textPreview: null } });
    const invites = await prisma.workspaceInvite.updateMany({ where: { status: "PENDING", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
    return { supportSessionsClosed: support.count, authSessionsRemoved: auth.count, verificationsRemoved: verification.count, rateLimitBucketsRemoved: buckets, previewsTrimmed: previews.count, invitesExpired: invites.count };
  },
};

/** Rebuilds the demo workspace on a schedule so public demo edits never accumulate. */
const resetDemo: JobDefinition = {
  name: "reset-demo-workspace",
  description: "Reset the demo workspace after the configured number of hours.",
  async run({ now, log }) {
    const env = getEnv();
    if (!env.DEMO_MODE) return { skipped: "DEMO_MODE is off" };
    const settings = await getSiteSettings();
    const demo = await prisma.workspace.findFirst({ where: { isDemo: true }, select: { id: true, updatedAt: true, createdAt: true } });
    const lastReset = await prisma.backgroundJobRun.findFirst({ where: { jobName: "reset-demo-workspace", status: "SUCCEEDED", result: { path: ["reset"], equals: true } }, orderBy: { startedAt: "desc" } });
    const ageHours = lastReset ? (now.getTime() - lastReset.startedAt.getTime()) / 3_600_000 : Infinity;
    if (demo && ageHours < settings["app.demoResetHours"]) return { reset: false, ageHours: Math.round(ageHours) };
    await seedDemoWorkspace({ now, log });
    return { reset: true };
  },
};

/** Records that the cron service is alive. */
const heartbeat: JobDefinition = {
  name: "heartbeat",
  description: "Record a cron heartbeat.",
  async run({ now }) {
    return { at: now.toISOString(), host: process.env.RAILWAY_SERVICE_NAME ?? process.env.HOSTNAME ?? "local" };
  },
};

export const JOBS: JobDefinition[] = [expireOverdueQuotes, sendExpiryReminders, cleanExpiredUploads, processRetention, aggregateAnalytics, recordStorageUsage, cleanupSessions, resetDemo, heartbeat];
