"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspaceAdmin } from "@/lib/auth";
import { createCheckoutSession, createPortalSession, mockActivateSubscription, setCancelAtPeriodEnd } from "@/lib/billing/stripe";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import type { BillingInterval, PlanKey } from "@/generated/prisma/enums";

const PLAN_KEYS: PlanKey[] = ["STARTER", "PRO", "CREDIT_PACK_5"];

export async function startCheckoutAction(formData: FormData): Promise<void> {
  const ctx = await requireWorkspaceAdmin();
  const planKey = String(formData.get("plan")) as PlanKey;
  const interval = (String(formData.get("interval")) === "YEAR" ? "YEAR" : "MONTH") as BillingInterval;
  if (!PLAN_KEYS.includes(planKey)) redirect("/app/billing?error=plan");
  let url: string;
  try {
    const result = await createCheckoutSession({ workspaceId: ctx.workspace.id, userId: ctx.user.id, email: ctx.user.email, workspaceName: ctx.workspace.name, planKey, interval });
    url = result.url;
  } catch (error) {
    redirect(`/app/billing?error=${encodeURIComponent(toUserMessage(error))}`);
  }
  redirect(url);
}

export async function openPortalAction(): Promise<void> {
  const ctx = await requireWorkspaceAdmin();
  let url: string;
  try {
    url = (await createPortalSession(ctx.workspace.id)).url;
  } catch (error) {
    redirect(`/app/billing?error=${encodeURIComponent(toUserMessage(error))}`);
  }
  redirect(url);
}

export async function completeMockCheckoutAction(formData: FormData): Promise<void> {
  const ctx = await requireWorkspaceAdmin();
  const planKey = String(formData.get("plan")) as PlanKey;
  const interval = (String(formData.get("interval")) === "YEAR" ? "YEAR" : "MONTH") as BillingInterval;
  if (!PLAN_KEYS.includes(planKey)) redirect("/app/billing?error=plan");
  try {
    await mockActivateSubscription(ctx.workspace.id, planKey, interval);
  } catch (error) {
    redirect(`/app/billing?error=${encodeURIComponent(toUserMessage(error))}`);
  }
  revalidatePath("/app/billing");
  redirect("/app/billing?checkout=success&mock=1");
}

export async function cancelSubscriptionAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWorkspaceAdmin();
    const cancel = formData.get("cancel") !== "false";
    await setCancelAtPeriodEnd(ctx.workspace.id, cancel);
    revalidatePath("/app/billing");
    return ok(undefined, cancel ? "Your subscription will end at the close of the current period." : "Your subscription has been restored.");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
