"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getStripe, isStripeConfigured, processStripeEvent } from "@/lib/billing/stripe";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { adminAction, adminAudit } from "../_lib/admin";

export async function retryWebhookAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const id = z.string().uuid().safeParse(formData.get("eventId"));
    if (!id.success) return fail("Invalid event.");
    const row = await prisma.stripeWebhookEvent.findUnique({ where: { id: id.data } });
    if (!row) return fail("Webhook event not found.");
    if (!isStripeConfigured()) return fail("Stripe is not configured, so events cannot be re-fetched for processing.");
    const stripe = getStripe()!;
    const event = await stripe.events.retrieve(row.stripeEventId);
    await prisma.stripeWebhookEvent.update({ where: { id: row.id }, data: { status: "RECEIVED", error: null, processedAt: null } });
    const result = await processStripeEvent(event);
    await adminAudit(admin, { action: "webhook.retry", targetType: "stripe_webhook_event", targetId: row.id, previousValue: { status: row.status, error: row.error }, newValue: { stripeEventId: row.stripeEventId, type: row.type, status: result.status, error: result.error ?? null } });
    revalidatePath("/super-admin/webhooks");
    if (result.status === "FAILED") return fail(`Processing failed again: ${result.error ?? "unknown error"}`);
    return ok(undefined, `Event ${row.type} re-processed: ${result.status.toLowerCase()}.`);
  });
}
