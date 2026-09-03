import Stripe from "stripe";
import type { BillingInterval, PlanKey, SubscriptionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { AppError } from "@/lib/utils/result";
import { addMonths } from "@/lib/utils/dates";
import { grantCredits } from "./credits";
import { ensureSubscription } from "./entitlements";
import { trackEvent } from "@/lib/services/app-events";

let stripeClient: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;
  const env = getEnv();
  stripeClient = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { typescript: true, appInfo: { name: "QuoteCue AI", version: "1.0.0" } }) : null;
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}

export async function resolvePriceId(planKey: PlanKey, interval: BillingInterval): Promise<string | null> {
  const env = getEnv();
  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!plan) return null;
  if (plan.kind === "CREDIT_PACK") return plan.stripeOneTimePriceId ?? env.STRIPE_CREDIT_PACK_PRICE_ID ?? null;
  const fromDb = interval === "YEAR" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;
  if (fromDb) return fromDb;
  if (planKey === "STARTER") return interval === "YEAR" ? env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? null : env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? null;
  if (planKey === "PRO") return interval === "YEAR" ? env.STRIPE_PRO_ANNUAL_PRICE_ID ?? null : env.STRIPE_PRO_MONTHLY_PRICE_ID ?? null;
  return null;
}

async function ensureStripeCustomer(stripe: Stripe, workspaceId: string, email: string, name: string): Promise<string> {
  const sub = await ensureSubscription(workspaceId);
  if (sub.stripeCustomerId) return sub.stripeCustomerId;
  const customer = await stripe.customers.create({ email, name, metadata: { workspaceId } });
  await prisma.subscription.update({ where: { workspaceId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(input: { workspaceId: string; userId: string; email: string; workspaceName: string; planKey: PlanKey; interval: BillingInterval }): Promise<{ url: string; mock: boolean }> {
  const env = getEnv();
  const stripe = getStripe();
  const plan = await prisma.plan.findUnique({ where: { key: input.planKey } });
  if (!plan || !plan.isActive) throw new AppError("That plan is not available.");
  await trackEvent({ name: "checkout_started", userId: input.userId, workspaceId: input.workspaceId, properties: { plan: input.planKey, interval: input.interval } });

  if (!stripe) {
    if (env.isProduction) throw new AppError("Billing is not configured.");
    const params = new URLSearchParams({ plan: input.planKey, interval: input.interval });
    return { url: `/app/billing/mock-checkout?${params.toString()}`, mock: true };
  }
  const priceId = await resolvePriceId(input.planKey, input.interval);
  if (!priceId) throw new AppError("This plan has no Stripe price configured yet. Please contact support.");
  const customerId = await ensureStripeCustomer(stripe, input.workspaceId, input.email, input.workspaceName);
  const isPack = plan.kind === "CREDIT_PACK";
  const session = await stripe.checkout.sessions.create({
    mode: isPack ? "payment" : "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.APP_URL}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/app/billing?checkout=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: input.workspaceId,
    metadata: { workspaceId: input.workspaceId, planKey: input.planKey, interval: input.interval, userId: input.userId },
    ...(isPack ? { payment_intent_data: { metadata: { workspaceId: input.workspaceId, planKey: input.planKey } } } : { subscription_data: { metadata: { workspaceId: input.workspaceId, planKey: input.planKey } } }),
  });
  if (!session.url) throw new AppError("Stripe did not return a checkout URL.");
  return { url: session.url, mock: false };
}

export async function createPortalSession(workspaceId: string): Promise<{ url: string; mock: boolean }> {
  const env = getEnv();
  const stripe = getStripe();
  if (!stripe) {
    if (env.isProduction) throw new AppError("Billing is not configured.");
    return { url: "/app/billing/mock-portal", mock: true };
  }
  const sub = await ensureSubscription(workspaceId);
  if (!sub.stripeCustomerId) throw new AppError("No billing account exists yet. Subscribe to a plan first.");
  const session = await stripe.billingPortal.sessions.create({ customer: sub.stripeCustomerId, return_url: `${env.APP_URL}/app/billing` });
  return { url: session.url, mock: false };
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "paused":
      return "PAUSED";
    default:
      return "ACTIVE";
  }
}

async function planForPrice(priceId: string | undefined | null): Promise<{ planId: string; planKey: PlanKey; interval: BillingInterval } | null> {
  if (!priceId) return null;
  const env = getEnv();
  const plans = await prisma.plan.findMany({ where: { kind: "SUBSCRIPTION" } });
  for (const plan of plans) {
    const monthly = plan.stripeMonthlyPriceId ?? (plan.key === "STARTER" ? env.STRIPE_STARTER_MONTHLY_PRICE_ID : plan.key === "PRO" ? env.STRIPE_PRO_MONTHLY_PRICE_ID : null);
    const annual = plan.stripeAnnualPriceId ?? (plan.key === "STARTER" ? env.STRIPE_STARTER_ANNUAL_PRICE_ID : plan.key === "PRO" ? env.STRIPE_PRO_ANNUAL_PRICE_ID : null);
    if (monthly === priceId) return { planId: plan.id, planKey: plan.key, interval: "MONTH" };
    if (annual === priceId) return { planId: plan.id, planKey: plan.key, interval: "YEAR" };
  }
  return null;
}

/** Writes the Stripe subscription state into our Subscription row. */
export async function syncSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const workspaceId = sub.metadata?.workspaceId ?? (await prisma.subscription.findFirst({ where: { OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id }] }, select: { workspaceId: true } }))?.workspaceId;
  if (!workspaceId) {
    console.warn("[stripe] subscription without workspace mapping", sub.id);
    return;
  }
  const item = sub.items.data[0];
  const mapped = await planForPrice(item?.price.id);
  const status = mapStatus(sub.status);
  const existing = await ensureSubscription(workspaceId);
  const free = await prisma.plan.findUniqueOrThrow({ where: { key: "FREE" } });
  const lapsed = status === "CANCELED" || status === "INCOMPLETE_EXPIRED" || status === "UNPAID";
  const periodStart = item?.current_period_start ? new Date(item.current_period_start * 1000) : existing.currentPeriodStart;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : existing.currentPeriodEnd;

  await prisma.subscription.update({
    where: { workspaceId },
    data: {
      planId: lapsed ? free.id : (mapped?.planId ?? existing.planId),
      status: lapsed && status === "CANCELED" ? "CANCELED" : status,
      interval: mapped?.interval ?? existing.interval,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      stripePriceId: item?.price.id ?? null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      lastSyncedAt: new Date(),
      ...(status === "ACTIVE" || status === "TRIALING" ? { lastPaymentFailureAt: null, lastPaymentFailureMessage: null } : {}),
    },
  });
  const wasActive = ["ACTIVE", "TRIALING"].includes(existing.status) && existing.planId !== free.id;
  if ((status === "ACTIVE" || status === "TRIALING") && !wasActive && mapped) {
    await trackEvent({ name: "subscription_activated", workspaceId, properties: { plan: mapped.planKey, interval: mapped.interval } });
    await notifySubscriptionConfirmed(workspaceId, mapped.planKey);
  }
  if (status === "CANCELED" && existing.status !== "CANCELED") {
    await trackEvent({ name: "subscription_cancelled", workspaceId });
  }
}

async function notifySubscriptionConfirmed(workspaceId: string, planKey: PlanKey) {
  const env = getEnv();
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: { select: { id: true, email: true, name: true } } } });
  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!ws || !plan) return;
  await sendEmail({
    kind: "SUBSCRIPTION_CONFIRMED",
    to: ws.owner.email,
    workspaceId,
    userId: ws.owner.id,
    variables: { name: ws.owner.name, planName: plan.name, billingUrl: `${env.APP_URL}/app/billing` },
  });
}

async function recordInvoice(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;
  const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId }, select: { workspaceId: true } });
  if (!sub) return null;
  const line = invoice.lines?.data?.[0];
  await prisma.billingInvoice.upsert({
    where: { stripeInvoiceId: invoice.id! },
    create: {
      workspaceId: sub.workspaceId,
      stripeInvoiceId: invoice.id!,
      number: invoice.number ?? null,
      status: invoice.status ?? "open",
      amountDueMinor: invoice.amount_due ?? 0,
      amountPaidMinor: invoice.amount_paid ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      description: line?.description ?? invoice.description ?? null,
      periodStart: line?.period?.start ? new Date(line.period.start * 1000) : null,
      periodEnd: line?.period?.end ? new Date(line.period.end * 1000) : null,
      paidAt: invoice.status === "paid" && invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
    },
    update: {
      status: invoice.status ?? "open",
      amountDueMinor: invoice.amount_due ?? 0,
      amountPaidMinor: invoice.amount_paid ?? 0,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      paidAt: invoice.status === "paid" && invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
    },
  });
  return sub.workspaceId;
}

/**
 * Processes a verified Stripe event exactly once. The event id is stored
 * before processing so retries from Stripe are ignored.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<{ status: "PROCESSED" | "IGNORED" | "DUPLICATE" | "FAILED"; error?: string }> {
  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing && existing.status === "PROCESSED") return { status: "DUPLICATE" };
  await prisma.stripeWebhookEvent.upsert({
    where: { stripeEventId: event.id },
    create: { stripeEventId: event.id, type: event.type, apiVersion: event.api_version ?? null, livemode: event.livemode, status: "RECEIVED", payloadSummary: { object: (event.data.object as { id?: string }).id ?? null } },
    update: { status: "RECEIVED", error: null },
  });
  try {
    let handled = true;
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspaceId ?? session.client_reference_id;
        const planKey = session.metadata?.planKey as PlanKey | undefined;
        if (session.mode === "payment" && workspaceId && planKey) {
          const plan = await prisma.plan.findUnique({ where: { key: planKey } });
          if (plan && plan.kind === "CREDIT_PACK") {
            await grantCredits({
              workspaceId,
              amount: plan.creditsGranted,
              type: "PACK_PURCHASE",
              reason: `${plan.name} purchase`,
              userId: session.metadata?.userId ?? null,
              idempotencyKey: `stripe:checkout:${session.id}`,
              metadata: { checkoutSessionId: session.id, paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null },
            });
            await trackEvent({ name: "credit_pack_purchased", workspaceId, properties: { credits: plan.creditsGranted } });
          }
        } else if (session.mode === "subscription" && session.subscription) {
          const stripe = getStripe();
          if (stripe) {
            const sub = await stripe.subscriptions.retrieve(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
            if (!sub.metadata?.workspaceId && workspaceId) sub.metadata = { ...sub.metadata, workspaceId };
            await syncSubscriptionFromStripe(sub);
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscriptionFromStripe(event.data.object);
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
      case "invoice.finalized":
        await recordInvoice(event.data.object);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const workspaceId = await recordInvoice(invoice);
        if (workspaceId) {
          const message = invoice.last_finalization_error?.message ?? "Your latest payment failed. Please update your payment method.";
          await prisma.subscription.update({ where: { workspaceId }, data: { lastPaymentFailureAt: new Date(), lastPaymentFailureMessage: message, status: "PAST_DUE" } });
          const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: true } });
          if (ws) {
            await sendEmail({
              kind: "PAYMENT_FAILED",
              to: ws.owner.email,
              workspaceId,
              userId: ws.ownerId,
              variables: { name: ws.owner.name, billingUrl: `${getEnv().APP_URL}/app/billing`, amount: `${((invoice.amount_due ?? 0) / 100).toFixed(2)} ${(invoice.currency ?? "usd").toUpperCase()}` },
            });
          }
        }
        break;
      }
      default:
        handled = false;
    }
    await prisma.stripeWebhookEvent.update({ where: { stripeEventId: event.id }, data: { status: handled ? "PROCESSED" : "IGNORED", processedAt: new Date() } });
    return { status: handled ? "PROCESSED" : "IGNORED" };
  } catch (error) {
    const message = (error as Error).message;
    await prisma.stripeWebhookEvent.update({ where: { stripeEventId: event.id }, data: { status: "FAILED", error: message.slice(0, 1000) } });
    return { status: "FAILED", error: message };
  }
}

/** Development-only mock: activates a subscription without Stripe. */
export async function mockActivateSubscription(workspaceId: string, planKey: PlanKey, interval: BillingInterval): Promise<void> {
  if (getEnv().isProduction) throw new AppError("Mock billing is disabled in production.");
  const plan = await prisma.plan.findUniqueOrThrow({ where: { key: planKey } });
  await ensureSubscription(workspaceId);
  const now = new Date();
  if (plan.kind === "CREDIT_PACK") {
    await grantCredits({ workspaceId, amount: plan.creditsGranted, type: "PACK_PURCHASE", reason: `${plan.name} (mock purchase)`, idempotencyKey: `mock:pack:${workspaceId}:${Date.now()}` });
    await trackEvent({ name: "credit_pack_purchased", workspaceId, properties: { credits: plan.creditsGranted, mock: true } });
    return;
  }
  await prisma.subscription.update({
    where: { workspaceId },
    data: {
      planId: plan.id,
      status: "ACTIVE",
      interval,
      stripeCustomerId: `cus_mock_${workspaceId.slice(0, 8)}`,
      stripeSubscriptionId: `sub_mock_${workspaceId.slice(0, 8)}_${Date.now()}`,
      currentPeriodStart: now,
      currentPeriodEnd: interval === "YEAR" ? addMonths(now, 12) : addMonths(now, 1),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      lastPaymentFailureAt: null,
      lastPaymentFailureMessage: null,
      lastSyncedAt: now,
    },
  });
  await prisma.billingInvoice.create({
    data: {
      workspaceId,
      stripeInvoiceId: `in_mock_${workspaceId.slice(0, 8)}_${Date.now()}`,
      number: `MOCK-${Date.now().toString().slice(-6)}`,
      status: "paid",
      amountDueMinor: interval === "YEAR" ? plan.annualPriceMinor : plan.monthlyPriceMinor,
      amountPaidMinor: interval === "YEAR" ? plan.annualPriceMinor : plan.monthlyPriceMinor,
      currency: plan.currency,
      description: `${plan.name} (${interval === "YEAR" ? "annual" : "monthly"}) — mock invoice`,
      periodStart: now,
      periodEnd: interval === "YEAR" ? addMonths(now, 12) : addMonths(now, 1),
      paidAt: now,
    },
  });
  await trackEvent({ name: "subscription_activated", workspaceId, properties: { plan: planKey, interval, mock: true } });
  await notifySubscriptionConfirmed(workspaceId, planKey);
}

export async function setCancelAtPeriodEnd(workspaceId: string, cancel: boolean): Promise<void> {
  const sub = await ensureSubscription(workspaceId);
  const stripe = getStripe();
  if (stripe && sub.stripeSubscriptionId && !sub.stripeSubscriptionId.startsWith("sub_mock_")) {
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: cancel });
    await syncSubscriptionFromStripe(updated);
    return;
  }
  if (getEnv().isProduction) throw new AppError("No active Stripe subscription to update.");
  await prisma.subscription.update({ where: { workspaceId }, data: { cancelAtPeriodEnd: cancel, canceledAt: cancel ? new Date() : null } });
}

export async function reconcileSubscription(workspaceId: string): Promise<{ synced: boolean; message: string }> {
  const stripe = getStripe();
  const sub = await ensureSubscription(workspaceId);
  if (!stripe) return { synced: false, message: "Stripe is not configured (mock billing mode)." };
  if (!sub.stripeSubscriptionId) return { synced: false, message: "No Stripe subscription linked to this workspace." };
  const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  if (!remote.metadata?.workspaceId) remote.metadata = { ...remote.metadata, workspaceId };
  await syncSubscriptionFromStripe(remote);
  return { synced: true, message: `Synced status ${remote.status} from Stripe.` };
}

export async function stripeHealthCheck(): Promise<{ ok: boolean; message: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, message: "Stripe is not configured: mock billing mode (development only)." };
  try {
    const balance = await stripe.balance.retrieve();
    return { ok: true, message: `Stripe reachable (${balance.livemode ? "live" : "test"} mode)` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
