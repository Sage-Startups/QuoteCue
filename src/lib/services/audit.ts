import { prisma } from "@/lib/db";
import { hashIp } from "@/lib/utils/tokens";

export interface AuditInput {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}

function toJson(value: unknown): object | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      reason: input.reason ?? null,
      previousValue: toJson(input.previousValue),
      newValue: toJson(input.newValue),
      ipHash: hashIp(input.ip),
    },
  });
}
