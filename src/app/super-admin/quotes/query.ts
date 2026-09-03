import type { Prisma } from "@/lib/db";
import { enumParam, excludeDemoFrom } from "../_lib/admin";

/** How long a recorded support-view grant unlocks a quote's private content. */
export const SUPPORT_VIEW_WINDOW_MS = 30 * 60 * 1000;

export const QUOTE_STATUSES = ["DRAFT", "READY", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED", "ARCHIVED"] as const;

export function buildQuoteWhere(params: { q?: string; status?: string; excludeDemo?: string }): Prisma.QuoteWhereInput {
  const where: Prisma.QuoteWhereInput = { deletedAt: null, workspace: { deletedAt: null, ...(excludeDemoFrom(params.excludeDemo) ? { isDemo: false } : {}) } };
  if (params.q) {
    where.OR = [{ number: { contains: params.q, mode: "insensitive" } }, { title: { contains: params.q, mode: "insensitive" } }, { workspace: { name: { contains: params.q, mode: "insensitive" } } }, { workspace: { slug: { contains: params.q, mode: "insensitive" } } }];
  }
  const status = enumParam(params.status, QUOTE_STATUSES);
  if (status) where.status = status;
  return where;
}
