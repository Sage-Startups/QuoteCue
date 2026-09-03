import type { Prisma } from "@/lib/db";
import { EMAIL_KINDS } from "@/lib/email/templates";
import { enumParam } from "../_lib/admin";

export const EMAIL_STATUSES = ["QUEUED", "SENT", "DELIVERED", "FAILED", "PREVIEW", "SKIPPED"] as const;

export function buildEmailWhere(params: { q?: string; kind?: string; status?: string }): Prisma.EmailEventWhereInput {
  const where: Prisma.EmailEventWhereInput = {};
  if (params.q) where.OR = [{ toEmail: { contains: params.q, mode: "insensitive" } }, { subject: { contains: params.q, mode: "insensitive" } }];
  const kind = enumParam(params.kind, EMAIL_KINDS);
  if (kind) where.kind = kind;
  const status = enumParam(params.status, EMAIL_STATUSES);
  if (status) where.status = status;
  return where;
}
