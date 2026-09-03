import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getStripe, processStripeEvent } from "@/lib/billing/stripe";
import { recordApplicationError } from "@/lib/services/app-events";

export const dynamic = "force-dynamic";

/** Stripe webhook endpoint. The signature is verified against the raw body and events are processed idempotently. */
export async function POST(request: NextRequest) {
  const env = getEnv();
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    await recordApplicationError("stripe.webhook.signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const result = await processStripeEvent(event);
  if (result.status === "FAILED") {
    await recordApplicationError("stripe.webhook.process", new Error(result.error ?? "unknown"), { eventId: event.id, type: event.type });
    return NextResponse.json({ received: true, status: result.status }, { status: 500 });
  }
  return NextResponse.json({ received: true, status: result.status });
}
