import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { assertFeature } from "@/lib/billing/entitlements";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { formatMoney } from "@/lib/utils/money";
import { addDays, formatDate } from "@/lib/utils/dates";
import { assertTransition } from "@/lib/quotes/status";
import { AppError } from "@/lib/utils/result";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { addQuoteEvent, getQuote } from "./quotes";
import { buildQuoteDocument } from "./quote-document";
import { ensurePublicLink } from "./public-quote";
import { storeGeneratedObject, readStoredObject } from "./uploads";
import { trackEvent } from "./app-events";
import { customerDisplayName } from "./customers";

/** Generates (or reuses) the PDF for the quote's current version and stores it privately. */
export async function generateQuotePdf(workspaceId: string, quoteId: string, userId: string | null, options: { force?: boolean } = {}) {
  const quote = await getQuote(workspaceId, quoteId);
  if (quote.pdfObjectId && !options.force) {
    const existing = await readStoredObject(quote.pdfObjectId);
    if (existing) return { buffer: existing.body, storedObjectId: quote.pdfObjectId, filename: `${quote.number}.pdf`, reused: true };
  }
  const document = await buildQuoteDocument(workspaceId, quoteId);
  const buffer = await renderQuotePdf(document);
  const stored = await storeGeneratedObject({ workspaceId, purpose: "QUOTE_PDF", body: buffer, mimeType: "application/pdf", filename: `${quote.number}.pdf` });
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { pdfObjectId: stored.id } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "PDF_GENERATED", actorUserId: userId, message: `PDF generated (${Math.round(buffer.length / 1024)} KB)` }),
  ]);
  return { buffer, storedObjectId: stored.id, filename: `${quote.number}.pdf`, reused: false };
}

export const sendQuoteSchema = z.object({
  toEmail: z.string().trim().email("Enter a valid customer email"),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  followUpDays: z.coerce.number().int().min(1).max(60).default(3),
});

/**
 * Sends the quote to the customer: generates the PDF, ensures the public
 * link, sends the email and moves the quote to SENT.
 */
export async function sendQuoteToCustomer(workspaceId: string, quoteId: string, userId: string | null, input: z.infer<typeof sendQuoteSchema>) {
  if (!(await isFeatureEnabled("email_sending"))) throw new AppError("Email sending is currently disabled by the administrator.");
  await enforceRateLimit("emailSend", workspaceId);
  const quote = await getQuote(workspaceId, quoteId);
  if (!quote.customerId || !quote.customer) throw new AppError("Choose a customer before sending the quote.");
  if ((quote.currentVersion?.items.length ?? 0) === 0) throw new AppError("Add at least one line item before sending.");
  if (quote.status === "ACCEPTED") throw new AppError("This quote has already been accepted.");
  assertTransition(quote.status, "SENT");
  await assertFeature(workspaceId, "ACCEPTANCE_LINKS");
  const now = new Date();
  const expiresAt = quote.expiresAt && quote.expiresAt > now ? quote.expiresAt : addDays(now, 30);
  await prisma.quote.update({ where: { id: quoteId }, data: { expiresAt, issuedAt: quote.issuedAt ?? now } });
  await generateQuotePdf(workspaceId, quoteId, userId, { force: true });
  const link = await ensurePublicLink(workspaceId, quoteId);
  const business = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId }, select: { businessName: true } });
  const message = (input.message?.trim() || quote.currentVersion?.followUpEmail || `Please find your quote for ${quote.title} below.`).replace(/\[QUOTE LINK\]/g, link.url);
  const outcome = await sendEmail({
    kind: "QUOTE_SENT",
    to: input.toEmail,
    workspaceId,
    userId,
    quoteId,
    variables: {
      customerName: quote.customer.contactName,
      businessName: business.businessName,
      quoteNumber: quote.number,
      quoteTitle: quote.title,
      total: formatMoney(quote.currentVersion?.totalMinor ?? 0, quote.currency),
      expiryDate: formatDate(expiresAt),
      quoteUrl: link.url,
      message,
    },
  });
  if (outcome.status === "FAILED") {
    await addQuoteEvent(prisma, { workspaceId, quoteId, type: "EMAIL_FAILED", actorUserId: userId, message: `Email to ${input.toEmail} failed: ${outcome.error ?? "unknown error"}` });
    throw new AppError(`The email could not be sent: ${outcome.error ?? "unknown error"}`);
  }
  const wasSent = quote.status === "SENT" || quote.status === "VIEWED";
  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: quote.status === "VIEWED" ? "VIEWED" : "SENT",
        sentAt: quote.sentAt ?? now,
        lastEmailedAt: now,
        followUpAt: addDays(now, input.followUpDays),
        wizardStep: 7,
        expiredAt: null,
      },
    }),
    addQuoteEvent(prisma, {
      workspaceId,
      quoteId,
      type: wasSent ? "EMAIL_DELIVERED" : "SENT",
      actorUserId: userId,
      message: outcome.previewMode ? `Quote ${wasSent ? "re-sent" : "sent"} to ${input.toEmail} (email preview mode: not delivered)` : `Quote ${wasSent ? "re-sent" : "sent"} to ${input.toEmail}`,
      metadata: { emailEventId: outcome.emailEventId, previewMode: outcome.previewMode },
    }),
  ]);
  if (!wasSent) await trackEvent({ name: "quote_sent", userId, workspaceId, properties: { quoteId, totalMinor: quote.currentVersion?.totalMinor ?? 0 } });
  return { link: link.url, previewMode: outcome.previewMode, status: outcome.status };
}

export async function markLinkCopied(workspaceId: string, quoteId: string, userId: string | null) {
  const quote = await getQuote(workspaceId, quoteId);
  if (quote.status === "DRAFT" || quote.status === "READY") {
    if (!quote.customerId) throw new AppError("Choose a customer before sharing the quote.");
    if ((quote.currentVersion?.items.length ?? 0) === 0) throw new AppError("Add at least one line item before sharing.");
    await assertFeature(workspaceId, "ACCEPTANCE_LINKS");
    const now = new Date();
    await prisma.quote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: quote.sentAt ?? now, issuedAt: quote.issuedAt ?? now, expiresAt: quote.expiresAt && quote.expiresAt > now ? quote.expiresAt : addDays(now, 30), followUpAt: addDays(now, 3), wizardStep: 7 } });
    await addQuoteEvent(prisma, { workspaceId, quoteId, type: "SENT", actorUserId: userId, message: "Quote shared via customer link" });
    await trackEvent({ name: "quote_sent", userId, workspaceId, properties: { quoteId, viaLink: true } });
  } else {
    await addQuoteEvent(prisma, { workspaceId, quoteId, type: "LINK_COPIED", actorUserId: userId, message: "Customer link copied" });
  }
  return ensurePublicLink(workspaceId, quoteId);
}

export function customerNameFor(quote: { customer: { contactName: string; companyName: string | null } | null }): string {
  return quote.customer ? customerDisplayName(quote.customer) : "No customer";
}
