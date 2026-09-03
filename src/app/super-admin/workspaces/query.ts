import type { Prisma } from "@/lib/db";
import { enumParam, excludeDemoFrom } from "../_lib/admin";

export const WORKSPACE_STATUSES = ["ACTIVE", "SUSPENDED", "PENDING_DELETION"] as const;

export function buildWorkspaceWhere(params: { q?: string; status?: string; excludeDemo?: string }): Prisma.WorkspaceWhereInput {
  const where: Prisma.WorkspaceWhereInput = { deletedAt: null };
  if (excludeDemoFrom(params.excludeDemo)) where.isDemo = false;
  if (params.q) {
    where.OR = [{ name: { contains: params.q, mode: "insensitive" } }, { slug: { contains: params.q, mode: "insensitive" } }, { owner: { email: { contains: params.q, mode: "insensitive" } } }];
  }
  const status = enumParam(params.status, WORKSPACE_STATUSES);
  if (status) where.status = status;
  return where;
}
