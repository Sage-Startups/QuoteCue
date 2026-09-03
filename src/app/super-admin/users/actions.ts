"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { grantCredits } from "@/lib/billing/credits";
import { deleteUserAccount, requireNotLastSuperAdmin } from "@/lib/services/account";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { parseDateInput } from "@/lib/utils/dates";
import { adminAction, adminAudit } from "../_lib/admin";

const idSchema = z.string().uuid("Invalid id");
const reasonSchema = z.string().trim().min(5, "Please give a reason (at least 5 characters)").max(500);

async function loadUser(userId: string) {
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return null;
  return prisma.user.findFirst({ where: { id: parsed.data, deletedAt: null } });
}

function revalidate(userId: string) {
  revalidatePath("/super-admin/users");
  revalidatePath(`/super-admin/users/${userId}`);
}

export async function suspendUserAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = z.object({ userId: idSchema, reason: reasonSchema }).safeParse({ userId: formData.get("userId"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please provide a reason.", zodFieldErrors(parsed.error));
    const user = await loadUser(parsed.data.userId);
    if (!user) return fail("User not found.");
    if (user.id === admin.user.id) return fail("You cannot suspend your own account.");
    if (user.suspendedAt) return fail("This user is already suspended.");
    if (user.platformRole === "SUPER_ADMIN") {
      const others = await prisma.user.count({ where: { platformRole: "SUPER_ADMIN", deletedAt: null, suspendedAt: null, id: { not: user.id } } });
      if (others === 0) return fail("Cannot suspend the only active super admin.");
    }
    const previous = { suspendedAt: user.suspendedAt, suspendedReason: user.suspendedReason };
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { suspendedAt: now, suspendedReason: parsed.data.reason } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    await adminAudit(admin, { action: "user.suspend", targetType: "user", targetId: user.id, reason: parsed.data.reason, previousValue: previous, newValue: { suspendedAt: now.toISOString(), suspendedReason: parsed.data.reason, sessionsRevoked: true } });
    revalidate(user.id);
    return ok(undefined, "User suspended and signed out everywhere.");
  });
}

export async function restoreUserAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const user = await loadUser(String(formData.get("userId") ?? ""));
    if (!user) return fail("User not found.");
    if (!user.suspendedAt) return fail("This user is not suspended.");
    const previous = { suspendedAt: user.suspendedAt, suspendedReason: user.suspendedReason };
    await prisma.user.update({ where: { id: user.id }, data: { suspendedAt: null, suspendedReason: null } });
    await adminAudit(admin, { action: "user.restore", targetType: "user", targetId: user.id, previousValue: previous, newValue: { suspendedAt: null, suspendedReason: null } });
    revalidate(user.id);
    return ok(undefined, "User restored.");
  });
}

export async function revokeSessionsAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const user = await loadUser(String(formData.get("userId") ?? ""));
    if (!user) return fail("User not found.");
    const result = await prisma.session.deleteMany({ where: { userId: user.id } });
    await adminAudit(admin, { action: "user.sessions.revoke", targetType: "user", targetId: user.id, previousValue: { sessions: result.count }, newValue: { sessions: 0 } });
    revalidate(user.id);
    return ok(undefined, `${result.count} session${result.count === 1 ? "" : "s"} revoked.`);
  });
}

export async function sendPasswordResetAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const user = await loadUser(String(formData.get("userId") ?? ""));
    if (!user) return fail("User not found.");
    await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/reset-password" }, headers: await headers() });
    await adminAudit(admin, { action: "user.password_reset.send", targetType: "user", targetId: user.id, newValue: { email: user.email } });
    return ok(undefined, "Password reset email sent.");
  });
}

const roleSchema = z.object({ userId: idSchema, role: z.enum(["USER", "SUPPORT_ADMIN", "SUPER_ADMIN"]), reason: reasonSchema });

export async function changeRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = roleSchema.safeParse({ userId: formData.get("userId"), role: formData.get("role"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const user = await loadUser(parsed.data.userId);
    if (!user) return fail("User not found.");
    if (user.platformRole === parsed.data.role) return fail("The user already has that role.");
    if (user.platformRole === "SUPER_ADMIN") {
      const others = await prisma.user.count({ where: { platformRole: "SUPER_ADMIN", deletedAt: null, id: { not: user.id } } });
      if (others === 0) return fail("Cannot demote the only super admin. Promote another super admin first.");
    }
    if (parsed.data.role !== "USER" && !user.emailVerified) return fail("Only verified accounts can hold an admin role.");
    await prisma.user.update({ where: { id: user.id }, data: { platformRole: parsed.data.role } });
    await adminAudit(admin, { action: "user.role.change", targetType: "user", targetId: user.id, reason: parsed.data.reason, previousValue: { platformRole: user.platformRole }, newValue: { platformRole: parsed.data.role } });
    revalidate(user.id);
    return ok(undefined, `Role changed to ${parsed.data.role.toLowerCase().replace("_", " ")}.`);
  });
}

const grantSchema = z.object({
  userId: idSchema,
  workspaceId: idSchema,
  amount: z.coerce.number().int().min(-500).max(500).refine((n) => n !== 0, "Amount cannot be zero"),
  type: z.enum(["ADMIN_GRANT", "PROMOTIONAL"]),
  reason: reasonSchema,
});

export async function grantUserCreditsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = grantSchema.safeParse({ userId: formData.get("userId"), workspaceId: formData.get("workspaceId"), amount: formData.get("amount"), type: formData.get("type"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const membership = await prisma.workspaceMember.findFirst({ where: { userId: parsed.data.userId, workspaceId: parsed.data.workspaceId }, include: { workspace: { select: { id: true, name: true, aiCreditBalance: true } } } });
    if (!membership) return fail("That workspace does not belong to this user.");
    const result = await grantCredits({ workspaceId: membership.workspaceId, amount: parsed.data.amount, type: parsed.data.type, reason: `${parsed.data.reason} (by ${admin.user.email})`, userId: admin.user.id });
    await adminAudit(admin, { action: "workspace.credits.grant", targetType: "workspace", targetId: membership.workspaceId, reason: parsed.data.reason, previousValue: { aiCreditBalance: membership.workspace.aiCreditBalance }, newValue: { aiCreditBalance: result.balance, delta: parsed.data.amount, type: parsed.data.type, forUserId: parsed.data.userId } });
    revalidate(parsed.data.userId);
    revalidatePath(`/super-admin/workspaces/${membership.workspaceId}`);
    return ok(undefined, `Credits updated. New balance for ${membership.workspace.name}: ${result.balance}.`);
  });
}

const complimentarySchema = z.object({
  userId: idSchema.optional(),
  workspaceId: idSchema,
  planId: idSchema,
  until: z.string().min(1, "Choose an end date"),
  reason: reasonSchema,
});

/** Applies a complimentary plan to a workspace (shared by the user and subscription pages). */
export async function applyComplimentaryPlanAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = complimentarySchema.safeParse({ userId: formData.get("userId") || undefined, workspaceId: formData.get("workspaceId"), planId: formData.get("planId"), until: formData.get("until"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const until = parseDateInput(parsed.data.until);
    if (!until || until.getTime() <= Date.now()) return fail("The end date must be in the future.", { until: ["Choose a future date"] });
    if (parsed.data.userId) {
      const membership = await prisma.workspaceMember.findFirst({ where: { userId: parsed.data.userId, workspaceId: parsed.data.workspaceId }, select: { id: true } });
      if (!membership) return fail("That workspace does not belong to this user.");
    }
    const [workspace, plan, subscription] = await Promise.all([
      prisma.workspace.findFirst({ where: { id: parsed.data.workspaceId, deletedAt: null }, select: { id: true, name: true } }),
      prisma.plan.findFirst({ where: { id: parsed.data.planId, kind: "SUBSCRIPTION", isActive: true }, select: { id: true, name: true, key: true } }),
      prisma.subscription.findUnique({ where: { workspaceId: parsed.data.workspaceId } }),
    ]);
    if (!workspace) return fail("Workspace not found.");
    if (!plan) return fail("Plan not found or inactive.");
    if (!subscription) return fail("This workspace has no subscription record yet.");
    if (subscription.stripeSubscriptionId && !subscription.stripeSubscriptionId.startsWith("sub_mock_") && subscription.status === "ACTIVE") {
      return fail("This workspace has an active Stripe subscription. Cancel it in Stripe before applying a complimentary plan.");
    }
    const previous = { planId: subscription.planId, status: subscription.status, complimentaryUntil: subscription.complimentaryUntil, complimentaryReason: subscription.complimentaryReason };
    const newValue = { planId: plan.id, planKey: plan.key, status: "COMPLIMENTARY", complimentaryUntil: until.toISOString(), complimentaryReason: parsed.data.reason };
    await prisma.subscription.update({ where: { workspaceId: workspace.id }, data: { planId: plan.id, status: "COMPLIMENTARY", complimentaryUntil: until, complimentaryReason: parsed.data.reason, cancelAtPeriodEnd: false } });
    await adminAudit(admin, { action: "subscription.complimentary.apply", targetType: "workspace", targetId: workspace.id, reason: parsed.data.reason, previousValue: previous, newValue });
    if (parsed.data.userId) revalidate(parsed.data.userId);
    revalidatePath(`/super-admin/workspaces/${workspace.id}`);
    revalidatePath("/super-admin/subscriptions");
    return ok(undefined, `${plan.name} applied to ${workspace.name} until ${parsed.data.until}.`);
  });
}

export async function deleteUserAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = z.object({ userId: idSchema, reason: reasonSchema }).safeParse({ userId: formData.get("userId"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please provide a reason.", zodFieldErrors(parsed.error));
    const user = await loadUser(parsed.data.userId);
    if (!user) return fail("User not found.");
    if (user.id === admin.user.id) return fail("You cannot delete your own account from here.");
    await requireNotLastSuperAdmin(user.id);
    const owned = await prisma.workspace.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, isDemo: true } });
    if (owned.some((w) => w.isDemo)) return fail("This user owns the demo workspace. Transfer ownership before deleting.");
    const snapshot = { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole, createdAt: user.createdAt, ownedWorkspaces: owned.map((w) => ({ id: w.id, name: w.name })) };
    await deleteUserAccount(user.id, { actorUserId: admin.user.id, reason: parsed.data.reason });
    await adminAudit(admin, { action: "user.delete", targetType: "user", targetId: user.id, reason: parsed.data.reason, previousValue: snapshot, newValue: null });
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/workspaces");
    return ok(undefined, "Account deleted.");
  });
}
