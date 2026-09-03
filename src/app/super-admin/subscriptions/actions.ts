"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { reconcileSubscription, setCancelAtPeriodEnd } from "@/lib/billing/stripe";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { adminAction, adminAudit } from "../_lib/admin";

const idSchema = z.string().uuid("Invalid id");
const reasonSchema = z.string().trim().min(5, "Please give a reason (at least 5 characters)").max(500);

function revalidate(workspaceId: string) {
  revalidatePath("/super-admin/subscriptions");
  revalidatePath(`/super-admin/subscriptions/${workspaceId}`);
  revalidatePath(`/super-admin/workspaces/${workspaceId}`);
}

async function loadSubscription(workspaceId: string) {
  const parsed = idSchema.safeParse(workspaceId);
  if (!parsed.success) return null;
  return prisma.subscription.findUnique({ where: { workspaceId: parsed.data }, include: { plan: { select: { id: true, key: true, name: true } } } });
}

const changePlanSchema = z.object({ workspaceId: idSchema, planId: idSchema, reason: reasonSchema });

/** Changes the plan mapping for a workspace's subscription without touching Stripe (used to correct mismatches). */
export async function changePlanMappingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = changePlanSchema.safeParse({ workspaceId: formData.get("workspaceId"), planId: formData.get("planId"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const sub = await loadSubscription(parsed.data.workspaceId);
    if (!sub) return fail("Subscription not found.");
    const plan = await prisma.plan.findFirst({ where: { id: parsed.data.planId, kind: "SUBSCRIPTION" }, select: { id: true, key: true, name: true } });
    if (!plan) return fail("Plan not found.", { planId: ["Choose a subscription plan"] });
    if (plan.id === sub.planId) return fail("The subscription is already mapped to that plan.");
    await prisma.subscription.update({ where: { workspaceId: sub.workspaceId }, data: { planId: plan.id } });
    await adminAudit(admin, { action: "subscription.plan.change", targetType: "workspace", targetId: sub.workspaceId, reason: parsed.data.reason, previousValue: { planId: sub.planId, planKey: sub.plan.key }, newValue: { planId: plan.id, planKey: plan.key } });
    revalidate(sub.workspaceId);
    return ok(undefined, `Plan mapping changed to ${plan.name}. Stripe was not modified.`);
  });
}

export async function setCancelAtPeriodEndAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = z.object({ workspaceId: idSchema, cancel: z.enum(["true", "false"]) }).safeParse({ workspaceId: formData.get("workspaceId"), cancel: formData.get("cancel") });
    if (!parsed.success) return fail("Invalid request.");
    const sub = await loadSubscription(parsed.data.workspaceId);
    if (!sub) return fail("Subscription not found.");
    const cancel = parsed.data.cancel === "true";
    if (sub.cancelAtPeriodEnd === cancel) return fail(cancel ? "Already set to cancel at period end." : "The subscription is not set to cancel.");
    await setCancelAtPeriodEnd(sub.workspaceId, cancel);
    await adminAudit(admin, { action: cancel ? "subscription.cancel_at_period_end" : "subscription.restore", targetType: "workspace", targetId: sub.workspaceId, previousValue: { cancelAtPeriodEnd: sub.cancelAtPeriodEnd }, newValue: { cancelAtPeriodEnd: cancel } });
    revalidate(sub.workspaceId);
    return ok(undefined, cancel ? "Subscription will cancel at the end of the period." : "Subscription restored.");
  });
}

export async function reconcileSubscriptionAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const sub = await loadSubscription(String(formData.get("workspaceId") ?? ""));
    if (!sub) return fail("Subscription not found.");
    const result = await reconcileSubscription(sub.workspaceId);
    const after = await prisma.subscription.findUnique({ where: { workspaceId: sub.workspaceId }, select: { status: true, planId: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } });
    await adminAudit(admin, { action: "subscription.reconcile", targetType: "workspace", targetId: sub.workspaceId, previousValue: { status: sub.status, planId: sub.planId, currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd }, newValue: { ...after, synced: result.synced, message: result.message } });
    revalidate(sub.workspaceId);
    return result.synced ? ok(undefined, result.message) : fail(result.message);
  });
}
