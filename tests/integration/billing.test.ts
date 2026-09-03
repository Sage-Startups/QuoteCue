import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { createUser, createWorkspace, cleanupWorkspace } from "./helpers";
import { consumeGeneration, refundGeneration, grantCredits } from "@/lib/billing/credits";
import { getWorkspaceEntitlements, assertCanGenerate } from "@/lib/billing/entitlements";
import { processStripeEvent, mockActivateSubscription } from "@/lib/billing/stripe";
import { EntitlementError } from "@/lib/utils/result";

let user: { id: string };
let ws: string;

beforeAll(async () => {
  user = await createUser("Billing User");
  ws = await createWorkspace(user.id, "Billing Co");
});

afterAll(async () => {
  await cleanupWorkspace(ws);
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
});

describe("credits and entitlements", () => {
  it("grants trial credits on onboarding and consumes them idempotently", async () => {
    const before = await getWorkspaceEntitlements(ws);
    expect(before.isTrial).toBe(true);
    expect(before.creditBalance).toBe(3);
    const first = await consumeGeneration({ workspaceId: ws, userId: user.id, idempotencyKey: "run-1" });
    expect(first.source).toBe("credit");
    expect(first.creditBalance).toBe(2);
    const again = await consumeGeneration({ workspaceId: ws, userId: user.id, idempotencyKey: "run-1" });
    expect(again.source).toBe("already_consumed");
    expect((await getWorkspaceEntitlements(ws)).creditBalance).toBe(2);
  });

  it("restores a credit when generation fails afterwards", async () => {
    await consumeGeneration({ workspaceId: ws, userId: user.id, idempotencyKey: "run-2" });
    expect((await getWorkspaceEntitlements(ws)).creditBalance).toBe(1);
    expect(await refundGeneration({ workspaceId: ws, idempotencyKey: "run-2", reason: "failed" })).toBe(true);
    expect(await refundGeneration({ workspaceId: ws, idempotencyKey: "run-2", reason: "failed" })).toBe(true);
    expect((await getWorkspaceEntitlements(ws)).creditBalance).toBe(2);
  });

  it("never lets the balance go negative", async () => {
    await consumeGeneration({ workspaceId: ws, userId: user.id, idempotencyKey: "run-3" });
    await consumeGeneration({ workspaceId: ws, userId: user.id, idempotencyKey: "run-4" });
    await expect(consumeGeneration({ workspaceId: ws, userId: user.id, idempotencyKey: "run-5" })).rejects.toBeInstanceOf(EntitlementError);
    await expect(assertCanGenerate(ws)).rejects.toBeInstanceOf(EntitlementError);
    await expect(grantCredits({ workspaceId: ws, amount: -1, type: "ADJUSTMENT", reason: "test" })).rejects.toThrow();
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: ws } });
    expect(workspace.aiCreditBalance).toBe(0);
  });

  it("uses the plan allowance before purchased credits after a (mock) upgrade", async () => {
    await mockActivateSubscription(ws, "STARTER", "MONTH");
    const ent = await getWorkspaceEntitlements(ws);
    expect(ent.planKey).toBe("STARTER");
    expect(ent.allowancePerPeriod).toBe(25);
    expect(ent.features.CUSTOM_LOGO).toBe(true);
    expect(ent.features.ADVANCED_ANALYTICS).toBe(false);
    const c = await consumeGeneration({ workspaceId: ws, userId: user.id, idempotencyKey: "run-6" });
    expect(c.source).toBe("allowance");
    expect((await getWorkspaceEntitlements(ws)).usedThisPeriod).toBe(1);
    const invoices = await prisma.billingInvoice.count({ where: { workspaceId: ws } });
    expect(invoices).toBe(1);
  });

  it("processes Stripe webhook events exactly once", async () => {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: "checkout.session.completed",
      api_version: "2026-08-26",
      livemode: false,
      data: { object: { id: "cs_test_1", mode: "payment", metadata: { workspaceId: ws, planKey: "CREDIT_PACK_5", userId: user.id }, client_reference_id: ws, payment_intent: "pi_test" } },
    } as unknown as Stripe.Event;
    const before = (await getWorkspaceEntitlements(ws)).creditBalance;
    const first = await processStripeEvent(event);
    expect(first.status).toBe("PROCESSED");
    const second = await processStripeEvent(event);
    expect(second.status).toBe("DUPLICATE");
    expect((await getWorkspaceEntitlements(ws)).creditBalance).toBe(before + 5);
    const stored = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
    expect(stored?.status).toBe("PROCESSED");
  });

  it("records payment failures and past-due state", async () => {
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    const event = {
      id: `evt_fail_${Date.now()}`,
      type: "invoice.payment_failed",
      livemode: false,
      data: { object: { id: `in_${Date.now()}`, customer: sub.stripeCustomerId, status: "open", amount_due: 1900, amount_paid: 0, currency: "usd", lines: { data: [] }, last_finalization_error: { message: "Card declined" } } },
    } as unknown as Stripe.Event;
    const result = await processStripeEvent(event);
    expect(result.status).toBe("PROCESSED");
    const ent = await getWorkspaceEntitlements(ws);
    expect(ent.status).toBe("PAST_DUE");
    expect(ent.paymentFailureMessage).toContain("Card declined");
    const email = await prisma.emailEvent.findFirst({ where: { workspaceId: ws, kind: "PAYMENT_FAILED" } });
    expect(email).not.toBeNull();
  });
});
