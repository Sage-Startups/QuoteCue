import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createUser, createWorkspace, cleanupWorkspace } from "./helpers";
import { createPresignedUpload, finalizeUpload } from "@/lib/services/uploads";
import { getStorage } from "@/lib/storage";
import { sendEmail } from "@/lib/email";
import { recordAudit } from "@/lib/services/audit";
import { deleteUserAccount } from "@/lib/services/account";
import { runAllJobs } from "@/jobs/run";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { addDays } from "@/lib/utils/dates";
import { createQuote } from "@/lib/services/quotes";

let user: { id: string; email: string };
let ws: string;

beforeAll(async () => {
  user = await createUser("Platform User");
  ws = await createWorkspace(user.id, "Platform Co");
});

afterAll(async () => {
  await cleanupWorkspace(ws);
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
});

describe("storage authorization and presigned uploads", () => {
  it("validates type and size, then completes an upload that exists in storage", async () => {
    await expect(createPresignedUpload({ workspaceId: ws, userId: user.id, purpose: "QUOTE_IMAGE", filename: "evil.exe", mimeType: "application/x-msdownload", sizeBytes: 100 })).rejects.toThrow(/not accepted/);
    await expect(createPresignedUpload({ workspaceId: ws, userId: user.id, purpose: "QUOTE_IMAGE", filename: "big.jpg", mimeType: "image/jpeg", sizeBytes: 500 * 1024 * 1024 })).rejects.toThrow(/too large/);
    await expect(createPresignedUpload({ workspaceId: ws, userId: user.id, purpose: "QUOTE_IMAGE", filename: "photo.png", mimeType: "image/jpeg", sizeBytes: 100 })).rejects.toThrow(/extension/);
    const presign = await createPresignedUpload({ workspaceId: ws, userId: user.id, purpose: "QUOTE_DOCUMENT", filename: "spec.txt", mimeType: "text/plain", sizeBytes: 11 });
    expect(presign.url).toContain("/api/storage/local/upload");
    // Nothing uploaded yet: finalize must fail and mark the upload failed.
    await expect(finalizeUpload({ uploadId: presign.uploadId, workspaceId: ws, userId: user.id })).rejects.toThrow(/did not reach storage/);
    const presign2 = await createPresignedUpload({ workspaceId: ws, userId: user.id, purpose: "QUOTE_DOCUMENT", filename: "spec.txt", mimeType: "text/plain", sizeBytes: 11 });
    const key = new URL(presign2.url).searchParams.get("key")!;
    await getStorage().putObject(key, Buffer.from("hello world"), "text/plain");
    const done = await finalizeUpload({ uploadId: presign2.uploadId, workspaceId: ws, userId: user.id });
    expect(done.storedObject.sizeBytes).toBe(11);
    // Another user/workspace cannot finalize or claim it.
    const other = await createUser("Intruder");
    await expect(finalizeUpload({ uploadId: presign2.uploadId, workspaceId: ws, userId: other.id })).rejects.toThrow(/not found/i);
    await prisma.user.delete({ where: { id: other.id } });
  });
});

describe("email, audit, rate limits and jobs", () => {
  it("records email events in preview mode without claiming delivery", async () => {
    const outcome = await sendEmail({ kind: "TEST", to: user.email, userId: user.id, variables: { name: "Tester" } });
    expect(outcome.status).toBe("PREVIEW");
    expect(outcome.previewMode).toBe(true);
    const event = await prisma.emailEvent.findUnique({ where: { id: outcome.emailEventId } });
    expect(event?.htmlPreview).toContain("Tester");
    const bad = await sendEmail({ kind: "TEST", to: user.email, templateOverride: { subject: "x", bodyMarkdown: "{{notAllowed}}" } });
    expect(bad.status).toBe("FAILED");
  });

  it("writes audit log entries with previous and new values", async () => {
    await recordAudit({ actorUserId: user.id, actorEmail: user.email, action: "test.action", targetType: "workspace", targetId: ws, previousValue: { a: 1 }, newValue: { a: 2 }, ip: "127.0.0.1" });
    const row = await prisma.adminAuditLog.findFirst({ where: { action: "test.action", targetId: ws } });
    expect(row?.previousValue).toEqual({ a: 1 });
    expect(row?.newValue).toEqual({ a: 2 });
    expect(row?.ipHash).toBeTruthy();
    expect(row?.ipHash).not.toContain("127.0.0.1");
  });

  it("rate limits by key and window", async () => {
    const key = `test-${Date.now()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit("unit", key, { limit: 3, windowSeconds: 60 }));
    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
    expect(results[3]?.allowed).toBe(false);
  });

  it("runs scheduled jobs idempotently and expires overdue quotes once", async () => {
    const quote = await createQuote({ workspaceId: ws, userId: user.id });
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "SENT", sentAt: addDays(new Date(), -40), expiresAt: addDays(new Date(), -1) } });
    const first = await runAllJobs({ only: ["expire-overdue-quotes", "heartbeat", "cleanup-sessions"] });
    expect(first.skipped).toBe(false);
    expect(first.failed).toBe(0);
    const second = await runAllJobs({ only: ["expire-overdue-quotes"] });
    expect(second.failed).toBe(0);
    const expired = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(expired.status).toBe("EXPIRED");
    const events = await prisma.quoteEvent.count({ where: { quoteId: quote.id, type: "EXPIRED" } });
    expect(events).toBe(1);
    const heartbeat = await prisma.backgroundJobRun.findFirst({ where: { jobName: "heartbeat", status: "SUCCEEDED" } });
    expect(heartbeat).not.toBeNull();
  });
});

describe("account deletion", () => {
  it("deletes the user and their solely-owned workspace with files", async () => {
    const victim = await createUser("Leaving User");
    const victimWs = await createWorkspace(victim.id, "Leaving Co");
    await prisma.storedObject.create({ data: { workspaceId: victimWs, key: "test/leaving.txt", bucket: "memory", purpose: "QUOTE_DOCUMENT", mimeType: "text/plain", sizeBytes: 1 } });
    await deleteUserAccount(victim.id);
    expect(await prisma.user.findUnique({ where: { id: victim.id } })).toBeNull();
    expect(await prisma.workspace.findUnique({ where: { id: victimWs } })).toBeNull();
    expect(await prisma.storedObject.count({ where: { workspaceId: victimWs } })).toBe(0);
  });
});
