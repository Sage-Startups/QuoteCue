import { createHmac } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/config/site-settings";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { hashToken } from "@/lib/utils/tokens";
import { addDays } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { computeExpired, isOpenForDecision } from "@/lib/quotes/status";
import { AppError, NotFoundError } from "@/lib/utils/result";
import { addQuoteEvent } from "./quotes";
import { buildQuoteDocument, type QuoteDocumentData } from "./quote-document";
import { trackEvent } from "./app-events";
import { customerDisplayName } from "./customers";

/**
 * Public quote tokens are derived from a server secret, the quote id and a
 * rotation counter. Only the SHA-256 hash of the token is stored, so a
 * database leak does not expose working links, yet the server can always
 * re-display the current link. Rotating increments the version.
 */
export function deriveQuoteToken(quoteId: string, version: number): string {
  return createHmac("sha256", `${getEnv().BETTER_AUTH_SECRET}:quote-link`).update(`${quoteId}:${version}`).digest("base64url");
}

export async function ensurePublicLink(workspaceId: string, quoteId: string): Promise<{ token: string; url: string; expiresAt: Date | null }> {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, workspaceId }, select: { id: true, publicTokenHash: true, publicTokenVersion: true, publicTokenExpiresAt: true } });
  if (!quote) throw new NotFoundError("Quote not found");
  const token = deriveQuoteToken(quote.id, quote.publicTokenVersion);
  const hash = hashToken(token);
  const settings = await getSiteSettings();
  let expiresAt = quote.publicTokenExpiresAt;
  if (quote.publicTokenHash !== hash || !expiresAt || expiresAt < new Date()) {
    expiresAt = addDays(new Date(), settings["app.publicLinkValidityDays"]);
    await prisma.quote.update({ where: { id: quote.id }, data: { publicTokenHash: hash, publicTokenExpiresAt: expiresAt } });
  }
  return { token, url: `${getEnv().APP_URL}/q/${token}`, expiresAt };
}

export async function rotatePublicLink(workspaceId: string, quoteId: string, userId: string | null): Promise<{ url: string }> {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, workspaceId }, select: { id: true, publicTokenVersion: true } });
  if (!quote) throw new NotFoundError("Quote not found");
  await prisma.quote.update({ where: { id: quote.id }, data: { publicTokenVersion: quote.publicTokenVersion + 1, publicTokenHash: null } });
  await addQuoteEvent(prisma, { workspaceId, quoteId, type: "UPDATED", actorUserId: userId, message: "Customer link rotated; the previous link no longer works" });
  const link = await ensurePublicLink(workspaceId, quoteId);
  return { url: link.url };
}

export interface PublicQuoteResult {
  quoteId: string;
  workspaceId: string;
  document: QuoteDocumentData;
  linkExpired: boolean;
  quoteExpired: boolean;
  canDecide: boolean;
  acceptanceEnabled: boolean;
  customerEmail: string | null;
}

export async function getPublicQuoteByToken(token: string): Promise<PublicQuoteResult | null> {
  if (!token || token.length > 200) return null;
  const quote = await prisma.quote.findFirst({
    where: { publicTokenHash: hashToken(token), deletedAt: null },
    select: { id: true, workspaceId: true, status: true, expiresAt: true, publicTokenExpiresAt: true, workspace: { select: { status: true, deletedAt: true } }, customer: { select: { email: true } } },
  });
  if (!quote || quote.workspace.deletedAt || quote.workspace.status !== "ACTIVE") return null;
  if (quote.status === "ARCHIVED" || quote.status === "DRAFT" || quote.status === "READY") return null;
  const now = new Date();
  const linkExpired = !!quote.publicTokenExpiresAt && quote.publicTokenExpiresAt < now;
  // Lazily expire an overdue quote when it is opened.
  let status = quote.status;
  if (computeExpired(status, quote.expiresAt, now)) {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED", expiredAt: now } });
    await addQuoteEvent(prisma, { workspaceId: quote.workspaceId, quoteId: quote.id, type: "EXPIRED", actorType: "SYSTEM", message: "Quote expired" });
    status = "EXPIRED";
  }
  const document = await buildQuoteDocument(quote.workspaceId, quote.id);
  const acceptanceEnabled = await isFeatureEnabled("customer_acceptance");
  return {
    quoteId: quote.id,
    workspaceId: quote.workspaceId,
    document: { ...document, quote: { ...document.quote, status } },
    linkExpired,
    quoteExpired: status === "EXPIRED",
    canDecide: !linkExpired && acceptanceEnabled && isOpenForDecision(status, quote.expiresAt, now),
    acceptanceEnabled,
    customerEmail: quote.customer?.email ?? null,
  };
}

/**
 * Records a customer view. The first legitimate view moves the quote to
 * VIEWED, adds an event and notifies the owner. Repeat views from the same
 * viewer cookie are not counted again; a new viewer key records a light-weight
 * repeat-view event at most once.
 */
export async function recordPublicView(quoteId: string, workspaceId: string, input: { viewerKey: string | null; ipHash: string | null; isNewViewer: boolean }): Promise<{ firstView: boolean }> {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, workspaceId }, select: { id: true, status: true, firstViewedAt: true, number: true, title: true, customer: { select: { contactName: true, companyName: true } }, createdById: true, workspace: { select: { owner: { select: { id: true, email: true, name: true } } } } } });
  if (!quote) return { firstView: false };
  const now = new Date();
  if (!quote.firstViewedAt) {
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({ where: { id: quote.id }, data: { firstViewedAt: now, lastViewedAt: now, viewCount: 1, status: quote.status === "SENT" ? "VIEWED" : quote.status } });
      await addQuoteEvent(tx, { workspaceId, quoteId: quote.id, type: "VIEWED", actorType: "CUSTOMER", message: "Customer opened the quote", ipHash: input.ipHash, metadata: { viewerKey: input.viewerKey } });
    });
    await trackEvent({ name: "quote_viewed", workspaceId, properties: { quoteId: quote.id } });
    const owner = quote.workspace.owner;
    const env = getEnv();
    await sendEmail({
      kind: "QUOTE_VIEWED",
      to: owner.email,
      workspaceId,
      userId: owner.id,
      quoteId: quote.id,
      variables: { customerName: quote.customer ? customerDisplayName(quote.customer) : "Your customer", quoteNumber: quote.number, quoteTitle: quote.title, quoteAdminUrl: `${env.APP_URL}/app/quotes/${quote.id}` },
    });
    return { firstView: true };
  }
  if (input.isNewViewer) {
    await prisma.$transaction([
      prisma.quote.update({ where: { id: quote.id }, data: { lastViewedAt: now, viewCount: { increment: 1 } } }),
      addQuoteEvent(prisma, { workspaceId, quoteId: quote.id, type: "VIEW_REPEAT", actorType: "CUSTOMER", message: "Quote opened again", ipHash: input.ipHash }),
    ]);
  } else {
    await prisma.quote.update({ where: { id: quote.id }, data: { lastViewedAt: now } });
  }
  return { firstView: false };
}

export const decisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  signedName: z.string().trim().max(120).optional().or(z.literal("")),
  termsAccepted: z.coerce.boolean().default(false),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function recordCustomerDecision(token: string, input: z.infer<typeof decisionSchema>, meta: { ipHash: string | null; userAgent: string | null }) {
  const result = await getPublicQuoteByToken(token);
  if (!result) throw new NotFoundError("This quote link is not valid.");
  if (!result.canDecide) throw new AppError("This quote can no longer be accepted or declined online. Please contact the business directly.");
  if (input.decision === "ACCEPTED") {
    if (!input.signedName || input.signedName.trim().length < 2) throw new AppError("Please type your full name to accept the quote.");
    if (!input.termsAccepted) throw new AppError("Please confirm you agree to the quote terms.");
  }
  const env = getEnv();
  const now = new Date();
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: result.quoteId }, include: { currentVersion: true, customer: true, workspace: { include: { owner: true } } } });
  if (!quote.currentVersion) throw new AppError("Quote has no current version.");
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.quote.findUniqueOrThrow({ where: { id: quote.id }, select: { status: true, expiresAt: true } });
    if (!isOpenForDecision(fresh.status, fresh.expiresAt, now)) throw new AppError("This quote has already been decided or has expired.");
    await tx.quoteAcceptance.create({
      data: {
        workspaceId: quote.workspaceId,
        quoteId: quote.id,
        versionId: quote.currentVersion!.id,
        decision: input.decision,
        signedName: input.decision === "ACCEPTED" ? input.signedName!.trim() : null,
        reason: input.reason?.trim() || null,
        termsAccepted: input.decision === "ACCEPTED" ? input.termsAccepted : false,
        ipHash: meta.ipHash,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        totalMinor: quote.currentVersion!.totalMinor,
      },
    });
    if (input.decision === "ACCEPTED") {
      await tx.quoteVersion.update({ where: { id: quote.currentVersion!.id }, data: { isLocked: true, lockedAt: now } });
      await tx.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED", acceptedAt: now, pdfObjectId: null } });
    } else {
      await tx.quote.update({ where: { id: quote.id }, data: { status: "DECLINED", declinedAt: now } });
    }
    await addQuoteEvent(tx, {
      workspaceId: quote.workspaceId,
      quoteId: quote.id,
      type: input.decision,
      actorType: "CUSTOMER",
      message: input.decision === "ACCEPTED" ? `Accepted by ${input.signedName?.trim()}` : `Declined${input.reason ? `: ${input.reason.trim()}` : ""}`,
      ipHash: meta.ipHash,
    });
  });
  await trackEvent({ name: input.decision === "ACCEPTED" ? "quote_accepted" : "quote_declined", workspaceId: quote.workspaceId, properties: { quoteId: quote.id, totalMinor: quote.currentVersion.totalMinor } });
  const owner = quote.workspace.owner;
  const customerName = quote.customer ? customerDisplayName(quote.customer) : "Your customer";
  await sendEmail({
    kind: input.decision === "ACCEPTED" ? "QUOTE_ACCEPTED" : "QUOTE_DECLINED",
    to: owner.email,
    workspaceId: quote.workspaceId,
    userId: owner.id,
    quoteId: quote.id,
    variables: {
      customerName,
      quoteNumber: quote.number,
      quoteTitle: quote.title,
      total: formatMoney(quote.currentVersion.totalMinor, quote.currency),
      signedName: input.signedName?.trim() ?? "",
      reason: input.reason?.trim() || "No reason given",
      quoteAdminUrl: `${env.APP_URL}/app/quotes/${quote.id}`,
    },
  });
  return { decision: input.decision };
}
