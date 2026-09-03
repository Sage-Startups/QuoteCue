import type { CreditLedgerType } from "@/generated/prisma/enums";
import { prisma, Prisma } from "@/lib/db";
import { EntitlementError } from "@/lib/utils/result";
import { getWorkspaceEntitlements } from "./entitlements";

export interface ConsumeResult {
  source: "allowance" | "credit" | "already_consumed";
  remainingAllowance: number;
  creditBalance: number;
}

/**
 * Consumes one AI generation for the workspace. Period allowance is used
 * first, then purchased credits. The operation is idempotent by key and runs
 * in a transaction so a credit can never be deducted twice.
 */
export async function consumeGeneration(input: { workspaceId: string; userId?: string | null; idempotencyKey: string; aiRunId?: string | null; reason?: string }): Promise<ConsumeResult> {
  const ent = await getWorkspaceEntitlements(input.workspaceId);
  return prisma.$transaction(async (tx) => {
    const existingLedger = await tx.creditLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
    if (existingLedger) {
      const ws = await tx.workspace.findUniqueOrThrow({ where: { id: input.workspaceId }, select: { aiCreditBalance: true } });
      return { source: "already_consumed", remainingAllowance: ent.allowanceRemaining, creditBalance: ws.aiCreditBalance };
    }

    if (ent.allowancePerPeriod > 0) {
      // Conditional increment: only succeeds while under the allowance.
      const updated = await tx.$executeRaw`
        INSERT INTO "UsageRecord" ("id", "workspaceId", "metric", "periodStart", "periodEnd", "count", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${input.workspaceId}::uuid, 'AI_GENERATION'::"UsageMetric", ${ent.currentPeriodStart}, ${ent.currentPeriodEnd}, 1, NOW(), NOW())
        ON CONFLICT ("workspaceId", "metric", "periodStart")
        DO UPDATE SET "count" = "UsageRecord"."count" + 1, "updatedAt" = NOW()
        WHERE "UsageRecord"."count" < ${ent.allowancePerPeriod}
      `;
      if (updated > 0) {
        await tx.creditLedgerEntry.create({
          data: {
            workspaceId: input.workspaceId,
            userId: input.userId ?? null,
            type: "CONSUMPTION",
            delta: 0,
            balanceAfter: ent.creditBalance,
            idempotencyKey: input.idempotencyKey,
            reason: input.reason ?? "AI generation (plan allowance)",
            aiRunId: input.aiRunId ?? null,
            metadata: { source: "allowance", periodStart: ent.currentPeriodStart.toISOString() },
          },
        });
        return { source: "allowance", remainingAllowance: Math.max(0, ent.allowanceRemaining - 1), creditBalance: ent.creditBalance };
      }
    }

    const decremented = await tx.workspace.updateMany({
      where: { id: input.workspaceId, aiCreditBalance: { gte: 1 } },
      data: { aiCreditBalance: { decrement: 1 } },
    });
    if (decremented.count === 0) {
      throw new EntitlementError("No AI generations available. Upgrade your plan or buy a credit pack to continue.");
    }
    const ws = await tx.workspace.findUniqueOrThrow({ where: { id: input.workspaceId }, select: { aiCreditBalance: true } });
    await tx.creditLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        type: "CONSUMPTION",
        delta: -1,
        balanceAfter: ws.aiCreditBalance,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason ?? "AI generation (credit)",
        aiRunId: input.aiRunId ?? null,
        metadata: { source: "credit" },
      },
    });
    return { source: "credit", remainingAllowance: 0, creditBalance: ws.aiCreditBalance };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

/** Restores a generation consumed under the given key (used if a later step fails). */
export async function refundGeneration(input: { workspaceId: string; idempotencyKey: string; reason: string }): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.creditLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (!original) return false;
    const refundKey = `${input.idempotencyKey}:refund`;
    const already = await tx.creditLedgerEntry.findUnique({ where: { idempotencyKey: refundKey }, select: { id: true } });
    if (already) return true;
    const meta = (original.metadata ?? {}) as { source?: string; periodStart?: string };
    if (meta.source === "allowance" && meta.periodStart) {
      await tx.usageRecord.updateMany({
        where: { workspaceId: input.workspaceId, metric: "AI_GENERATION", periodStart: new Date(meta.periodStart), count: { gt: 0 } },
        data: { count: { decrement: 1 } },
      });
      const ws = await tx.workspace.findUniqueOrThrow({ where: { id: input.workspaceId }, select: { aiCreditBalance: true } });
      await tx.creditLedgerEntry.create({
        data: { workspaceId: input.workspaceId, type: "REFUND", delta: 0, balanceAfter: ws.aiCreditBalance, idempotencyKey: refundKey, reason: input.reason, metadata: { source: "allowance" } },
      });
      return true;
    }
    const ws = await tx.workspace.update({ where: { id: input.workspaceId }, data: { aiCreditBalance: { increment: 1 } }, select: { aiCreditBalance: true } });
    await tx.creditLedgerEntry.create({
      data: { workspaceId: input.workspaceId, type: "REFUND", delta: 1, balanceAfter: ws.aiCreditBalance, idempotencyKey: refundKey, reason: input.reason, metadata: { source: "credit" } },
    });
    return true;
  });
}

export async function grantCredits(input: {
  workspaceId: string;
  amount: number;
  type: Extract<CreditLedgerType, "TRIAL_GRANT" | "PACK_PURCHASE" | "ADMIN_GRANT" | "PROMOTIONAL" | "ADJUSTMENT">;
  reason: string;
  userId?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ balance: number; applied: boolean }> {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new Error("Credit amount must be a non-zero integer");
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.creditLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { balanceAfter: true } });
      if (existing) return { balance: existing.balanceAfter, applied: false };
    }
    if (input.amount < 0) {
      const ok = await tx.workspace.updateMany({ where: { id: input.workspaceId, aiCreditBalance: { gte: -input.amount } }, data: { aiCreditBalance: { increment: input.amount } } });
      if (ok.count === 0) throw new Error("Adjustment would make the credit balance negative");
    } else {
      await tx.workspace.update({ where: { id: input.workspaceId }, data: { aiCreditBalance: { increment: input.amount } } });
    }
    const ws = await tx.workspace.findUniqueOrThrow({ where: { id: input.workspaceId }, select: { aiCreditBalance: true } });
    await tx.creditLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        type: input.type,
        delta: input.amount,
        balanceAfter: ws.aiCreditBalance,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      },
    });
    return { balance: ws.aiCreditBalance, applied: true };
  });
}
