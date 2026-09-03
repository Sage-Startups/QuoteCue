import type { Prisma } from "@/lib/db";
import { enumParam } from "../_lib/admin";

const ROLES = ["USER", "SUPPORT_ADMIN", "SUPER_ADMIN"] as const;

export function buildUserWhere(params: { q?: string; role?: string; verified?: string; suspended?: string }): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (params.q) where.OR = [{ email: { contains: params.q, mode: "insensitive" } }, { name: { contains: params.q, mode: "insensitive" } }];
  const role = enumParam(params.role, ROLES);
  if (role) where.platformRole = role;
  if (params.verified === "1") where.emailVerified = true;
  if (params.verified === "0") where.emailVerified = false;
  if (params.suspended === "1") where.suspendedAt = { not: null };
  if (params.suspended === "0") where.suspendedAt = null;
  return where;
}
