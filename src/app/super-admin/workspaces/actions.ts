"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { grantCredits } from "@/lib/billing/credits";
import { deleteWorkspaceCompletely } from "@/lib/services/account";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { adminAction, adminAudit } from "../_lib/admin";

const idSchema = z.string().uuid("Invalid id");
const reasonSchema = z.string().trim().min(5, "Please give a reason (at least 5 characters)").max(500);

async function loadWorkspace(workspaceId: string) {
  const parsed = idSchema.safeParse(workspaceId);
  if (!parsed.success) return null;
  return prisma.workspace.findFirst({ where: { id: parsed.data, deletedAt: null } });
}

function revalidate(workspaceId: string) {
  revalidatePath("/super-admin/workspaces");
  revalidatePath(`/super-admin/workspaces/${workspaceId}`);
}

export async function suspendWorkspaceAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = z.object({ workspaceId: idSchema, reason: reasonSchema }).safeParse({ workspaceId: formData.get("workspaceId"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please provide a reason.", zodFieldErrors(parsed.error));
    const workspace = await loadWorkspace(parsed.data.workspaceId);
    if (!workspace) return fail("Workspace not found.");
    if (workspace.status === "SUSPENDED") return fail("This workspace is already suspended.");
    if (workspace.isDemo) return fail("The demo workspace cannot be suspended.");
    const previous = { status: workspace.status, suspendedReason: workspace.suspendedReason };
    await prisma.workspace.update({ where: { id: workspace.id }, data: { status: "SUSPENDED", suspendedReason: parsed.data.reason } });
    await adminAudit(admin, { action: "workspace.suspend", targetType: "workspace", targetId: workspace.id, reason: parsed.data.reason, previousValue: previous, newValue: { status: "SUSPENDED", suspendedReason: parsed.data.reason } });
    revalidate(workspace.id);
    return ok(undefined, "Workspace suspended.");
  });
}

export async function restoreWorkspaceAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const workspace = await loadWorkspace(String(formData.get("workspaceId") ?? ""));
    if (!workspace) return fail("Workspace not found.");
    if (workspace.status !== "SUSPENDED") return fail("This workspace is not suspended.");
    const previous = { status: workspace.status, suspendedReason: workspace.suspendedReason };
    await prisma.workspace.update({ where: { id: workspace.id }, data: { status: "ACTIVE", suspendedReason: null } });
    await adminAudit(admin, { action: "workspace.restore", targetType: "workspace", targetId: workspace.id, previousValue: previous, newValue: { status: "ACTIVE", suspendedReason: null } });
    revalidate(workspace.id);
    return ok(undefined, "Workspace restored.");
  });
}

const grantSchema = z.object({
  workspaceId: idSchema,
  amount: z.coerce.number().int().min(1, "Amount must be at least 1").max(500),
  reason: reasonSchema,
});

export async function grantWorkspaceCreditsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = grantSchema.safeParse({ workspaceId: formData.get("workspaceId"), amount: formData.get("amount"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const workspace = await loadWorkspace(parsed.data.workspaceId);
    if (!workspace) return fail("Workspace not found.");
    const idempotencyKey = `admin-promo:${workspace.id}:${admin.user.id}:${Date.now()}`;
    const result = await grantCredits({ workspaceId: workspace.id, amount: parsed.data.amount, type: "PROMOTIONAL", reason: `${parsed.data.reason} (by ${admin.user.email})`, userId: admin.user.id, idempotencyKey });
    await adminAudit(admin, { action: "workspace.credits.grant", targetType: "workspace", targetId: workspace.id, reason: parsed.data.reason, previousValue: { aiCreditBalance: workspace.aiCreditBalance }, newValue: { aiCreditBalance: result.balance, delta: parsed.data.amount, type: "PROMOTIONAL" } });
    revalidate(workspace.id);
    return ok(undefined, `Promotional credits added. New balance: ${result.balance}.`);
  });
}

export async function startWorkspaceDeletionAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = z.object({ workspaceId: idSchema, reason: reasonSchema }).safeParse({ workspaceId: formData.get("workspaceId"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please provide a reason.", zodFieldErrors(parsed.error));
    const workspace = await loadWorkspace(parsed.data.workspaceId);
    if (!workspace) return fail("Workspace not found.");
    if (workspace.isDemo) return fail("The demo workspace cannot be deleted.");
    if (workspace.status === "PENDING_DELETION") return fail("Deletion has already been requested.");
    const now = new Date();
    const previous = { status: workspace.status, deletionRequestedAt: workspace.deletionRequestedAt };
    await prisma.workspace.update({ where: { id: workspace.id }, data: { status: "PENDING_DELETION", deletionRequestedAt: now } });
    await adminAudit(admin, { action: "workspace.deletion.start", targetType: "workspace", targetId: workspace.id, reason: parsed.data.reason, previousValue: previous, newValue: { status: "PENDING_DELETION", deletionRequestedAt: now.toISOString() } });
    revalidate(workspace.id);
    return ok(undefined, "Workspace marked for deletion.");
  });
}

export async function cancelWorkspaceDeletionAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const workspace = await loadWorkspace(String(formData.get("workspaceId") ?? ""));
    if (!workspace) return fail("Workspace not found.");
    if (workspace.status !== "PENDING_DELETION") return fail("This workspace is not pending deletion.");
    const previous = { status: workspace.status, deletionRequestedAt: workspace.deletionRequestedAt };
    await prisma.workspace.update({ where: { id: workspace.id }, data: { status: "ACTIVE", deletionRequestedAt: null } });
    await adminAudit(admin, { action: "workspace.deletion.cancel", targetType: "workspace", targetId: workspace.id, previousValue: previous, newValue: { status: "ACTIVE", deletionRequestedAt: null } });
    revalidate(workspace.id);
    return ok(undefined, "Deletion cancelled. Workspace is active again.");
  });
}

export async function deleteWorkspaceNowAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = z.object({ workspaceId: idSchema, reason: reasonSchema }).safeParse({ workspaceId: formData.get("workspaceId"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please provide a reason.", zodFieldErrors(parsed.error));
    const workspace = await loadWorkspace(parsed.data.workspaceId);
    if (!workspace) return fail("Workspace not found.");
    if (workspace.isDemo) return fail("The demo workspace cannot be deleted.");
    const [members, quotes, objects] = await Promise.all([
      prisma.workspaceMember.count({ where: { workspaceId: workspace.id } }),
      prisma.quote.count({ where: { workspaceId: workspace.id } }),
      prisma.storedObject.count({ where: { workspaceId: workspace.id } }),
    ]);
    const snapshot = { id: workspace.id, name: workspace.name, slug: workspace.slug, ownerId: workspace.ownerId, status: workspace.status, createdAt: workspace.createdAt, members, quotes, storedObjects: objects };
    await deleteWorkspaceCompletely(workspace.id);
    await adminAudit(admin, { action: "workspace.delete", targetType: "workspace", targetId: workspace.id, reason: parsed.data.reason, previousValue: snapshot, newValue: null });
    revalidatePath("/super-admin/workspaces");
    revalidatePath("/super-admin/users");
    return ok(undefined, "Workspace deleted permanently.");
  });
}
