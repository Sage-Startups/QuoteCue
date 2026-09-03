import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { QuoteEventType, QuoteStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { calculateQuote, parseQuantity } from "@/lib/quotes/pricing";
import { assertTransition, isEditable } from "@/lib/quotes/status";
import { addDays } from "@/lib/utils/dates";
import { AppError, NotFoundError } from "@/lib/utils/result";
import { trackEvent } from "./app-events";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Numbering
// ---------------------------------------------------------------------------

/** Atomically allocates the next quote number for the workspace and year. */
export async function allocateQuoteNumber(tx: Tx, workspaceId: string, prefix: string, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const rows = await tx.$queryRaw<Array<{ nextNumber: number }>>`
    INSERT INTO "QuoteCounter" ("id", "workspaceId", "year", "nextNumber")
    VALUES (gen_random_uuid(), ${workspaceId}::uuid, ${year}, 2)
    ON CONFLICT ("workspaceId", "year") DO UPDATE SET "nextNumber" = "QuoteCounter"."nextNumber" + 1
    RETURNING "nextNumber"
  `;
  const allocated = (rows[0]?.nextNumber ?? 2) - 1;
  return `${prefix.toUpperCase()}-${year}-${String(allocated).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function addQuoteEvent(
  db: Tx | typeof prisma,
  input: { workspaceId: string; quoteId: string; type: QuoteEventType; actorType?: "USER" | "CUSTOMER" | "SYSTEM" | "ADMIN"; actorUserId?: string | null; message?: string | null; metadata?: Record<string, unknown>; ipHash?: string | null },
) {
  return db.quoteEvent.create({
    data: {
      workspaceId: input.workspaceId,
      quoteId: input.quoteId,
      type: input.type,
      actorType: input.actorType ?? (input.actorUserId ? "USER" : "SYSTEM"),
      actorUserId: input.actorUserId ?? null,
      message: input.message ?? null,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      ipHash: input.ipHash ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export const quoteInclude = {
  customer: true,
  template: true,
  createdBy: { select: { id: true, name: true } },
  currentVersion: { include: { items: { orderBy: { sortOrder: "asc" as const }, include: { catalogueItem: { select: { id: true, name: true } } } } } },
  media: { orderBy: { sortOrder: "asc" as const }, include: { storedObject: true } },
  pdfObject: true,
  versions: { orderBy: { versionNumber: "desc" as const }, select: { id: true, versionNumber: true, totalMinor: true, isLocked: true, lockedAt: true, createdAt: true, title: true } },
  acceptances: { orderBy: { createdAt: "desc" as const } },
  _count: { select: { events: true } },
} satisfies Prisma.QuoteInclude;

export type QuoteWithDetails = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

export async function getQuote(workspaceId: string, quoteId: string): Promise<QuoteWithDetails> {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, workspaceId, deletedAt: null }, include: quoteInclude });
  if (!quote) throw new NotFoundError("Quote not found");
  return quote;
}

export async function getQuoteEvents(workspaceId: string, quoteId: string) {
  return prisma.quoteEvent.findMany({ where: { workspaceId, quoteId }, orderBy: { createdAt: "desc" }, include: { actorUser: { select: { name: true } } }, take: 200 });
}

export async function getQuoteEmailEvents(workspaceId: string, quoteId: string) {
  return prisma.emailEvent.findMany({ where: { workspaceId, quoteId }, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, toEmail: true, subject: true, status: true, error: true, createdAt: true, provider: true }, take: 50 });
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export const quoteBasicsSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  reference: z.string().trim().max(60).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
  jobAddressLine1: z.string().trim().max(120).optional().or(z.literal("")),
  jobAddressLine2: z.string().trim().max(120).optional().or(z.literal("")),
  jobCity: z.string().trim().max(80).optional().or(z.literal("")),
  jobRegion: z.string().trim().max(80).optional().or(z.literal("")),
  jobPostalCode: z.string().trim().max(20).optional().or(z.literal("")),
  jobCountry: z.string().trim().max(2).optional().or(z.literal("")),
});
export type QuoteBasicsInput = z.infer<typeof quoteBasicsSchema>;

function nul(v: string | undefined | null): string | null {
  return v && v.trim() ? v.trim() : null;
}

export async function createQuote(input: { workspaceId: string; userId: string | null; basics?: Partial<QuoteBasicsInput>; templateId?: string | null; now?: Date }) {
  const now = input.now ?? new Date();
  const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId: input.workspaceId } });
  const template = input.templateId
    ? await prisma.quoteTemplate.findFirst({ where: { id: input.templateId, workspaceId: input.workspaceId, archivedAt: null } })
    : await prisma.quoteTemplate.findFirst({ where: { workspaceId: input.workspaceId, isDefault: true, archivedAt: null } });
  let customer: { id: string; jobAddressLine1: string | null; jobAddressLine2: string | null; jobCity: string | null; jobRegion: string | null; jobPostalCode: string | null; jobCountry: string | null } | null = null;
  if (input.basics?.customerId) {
    customer = await prisma.customer.findFirst({ where: { id: input.basics.customerId, workspaceId: input.workspaceId }, select: { id: true, jobAddressLine1: true, jobAddressLine2: true, jobCity: true, jobRegion: true, jobPostalCode: true, jobCountry: true } });
    if (!customer) throw new NotFoundError("Customer not found");
  }
  const expiresAt = input.basics?.expiresAt ? new Date(`${input.basics.expiresAt}T23:59:59.999Z`) : addDays(now, settings.quoteValidityDays);
  const title = nul(input.basics?.title) ?? template?.defaultTitle ?? "New quote";

  const quote = await prisma.$transaction(async (tx) => {
    const number = await allocateQuoteNumber(tx, input.workspaceId, settings.quoteNumberPrefix, now);
    const created = await tx.quote.create({
      data: {
        workspaceId: input.workspaceId,
        customerId: customer?.id ?? null,
        templateId: template?.id ?? null,
        createdById: input.userId,
        number,
        reference: nul(input.basics?.reference),
        title,
        currency: settings.currency,
        expiresAt,
        jobAddressLine1: nul(input.basics?.jobAddressLine1) ?? customer?.jobAddressLine1 ?? null,
        jobAddressLine2: nul(input.basics?.jobAddressLine2) ?? customer?.jobAddressLine2 ?? null,
        jobCity: nul(input.basics?.jobCity) ?? customer?.jobCity ?? null,
        jobRegion: nul(input.basics?.jobRegion) ?? customer?.jobRegion ?? null,
        jobPostalCode: nul(input.basics?.jobPostalCode) ?? customer?.jobPostalCode ?? null,
        jobCountry: nul(input.basics?.jobCountry) ?? customer?.jobCountry ?? null,
        wizardStep: customer ? 2 : 1,
      },
      select: { id: true, number: true },
    });
    const version = await tx.quoteVersion.create({
      data: {
        workspaceId: input.workspaceId,
        quoteId: created.id,
        versionNumber: 1,
        title,
        scopeOfWork: template?.scopeOfWork ?? null,
        includedWork: template?.includedWork ?? null,
        assumptions: template?.assumptions ?? null,
        exclusions: template?.exclusions ?? null,
        customerResponsibilities: template?.customerResponsibilities ?? null,
        customerQuestions: template?.customerQuestions ?? undefined,
        paymentTerms: template?.paymentTerms ?? settings.paymentTerms,
        estimatedSchedule: template?.estimatedSchedule ?? null,
        warrantyWording: template?.warrantyWording ?? settings.warrantyWording,
        validityWording: `This quote is valid for ${settings.quoteValidityDays} days from the issue date.`,
        depositTerms: settings.depositTerms,
        pricingMode: settings.pricingMode,
        taxLabel: settings.taxLabel,
        taxRateBps: settings.pricingMode === "NO_TAX" ? 0 : settings.taxRateBps,
        callOutFeeMinor: 0,
      },
      select: { id: true },
    });
    await tx.quote.update({ where: { id: created.id }, data: { currentVersionId: version.id } });
    await addQuoteEvent(tx, { workspaceId: input.workspaceId, quoteId: created.id, type: "CREATED", actorUserId: input.userId, message: `Quote ${number} created` });
    return created;
  });
  await trackEvent({ name: "quote_started", userId: input.userId, workspaceId: input.workspaceId, properties: { quoteId: quote.id } });
  return quote;
}

export async function updateQuoteBasics(workspaceId: string, quoteId: string, userId: string | null, input: QuoteBasicsInput) {
  const quote = await getQuote(workspaceId, quoteId);
  if (!isEditable(quote.status)) throw new AppError("This quote can no longer be edited. Create a revision instead.");
  let customerId: string | null = quote.customerId;
  if (input.customerId !== undefined) {
    if (input.customerId) {
      const c = await prisma.customer.findFirst({ where: { id: input.customerId, workspaceId }, select: { id: true } });
      if (!c) throw new NotFoundError("Customer not found");
      customerId = c.id;
    } else {
      customerId = null;
    }
  }
  const title = nul(input.title) ?? quote.title;
  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        customerId,
        title,
        reference: nul(input.reference),
        expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T23:59:59.999Z`) : quote.expiresAt,
        jobAddressLine1: nul(input.jobAddressLine1),
        jobAddressLine2: nul(input.jobAddressLine2),
        jobCity: nul(input.jobCity),
        jobRegion: nul(input.jobRegion),
        jobPostalCode: nul(input.jobPostalCode),
        jobCountry: nul(input.jobCountry)?.toUpperCase() ?? null,
        wizardStep: Math.max(quote.wizardStep, 2),
      },
    }),
    ...(quote.currentVersionId ? [prisma.quoteVersion.update({ where: { id: quote.currentVersionId }, data: { title } })] : []),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "UPDATED", actorUserId: userId, message: "Quote details updated" }),
  ]);
}

export const enquirySchema = z.object({
  enquiryText: z.string().trim().max(8000).optional().or(z.literal("")),
  jobNotes: z.string().trim().max(8000).optional().or(z.literal("")),
  transcript: z.string().trim().max(12000).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export async function updateEnquiry(workspaceId: string, quoteId: string, userId: string | null, input: z.infer<typeof enquirySchema>) {
  const quote = await getQuote(workspaceId, quoteId);
  if (!isEditable(quote.status)) throw new AppError("This quote can no longer be edited.");
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      enquiryText: nul(input.enquiryText),
      jobNotes: nul(input.jobNotes),
      transcript: input.transcript === undefined ? undefined : nul(input.transcript),
      internalNotes: input.internalNotes === undefined ? undefined : nul(input.internalNotes),
      wizardStep: Math.max(quote.wizardStep, 2),
    },
  });
}

export async function setWizardStep(workspaceId: string, quoteId: string, step: number) {
  await prisma.quote.updateMany({ where: { id: quoteId, workspaceId }, data: { wizardStep: Math.min(7, Math.max(1, step)) } });
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function attachQuoteMedia(workspaceId: string, quoteId: string, storedObjectId: string, kind: "IMAGE" | "AUDIO" | "DOCUMENT", extras?: { transcript?: string | null; caption?: string | null }) {
  const [quote, object] = await Promise.all([
    prisma.quote.findFirst({ where: { id: quoteId, workspaceId, deletedAt: null }, select: { id: true, status: true } }),
    prisma.storedObject.findFirst({ where: { id: storedObjectId, workspaceId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!quote) throw new NotFoundError("Quote not found");
  if (!object) throw new NotFoundError("File not found");
  const count = await prisma.quoteMedia.count({ where: { quoteId } });
  return prisma.quoteMedia.create({
    data: { workspaceId, quoteId, storedObjectId, kind, sortOrder: count, transcript: extras?.transcript ?? null, caption: extras?.caption ?? null },
    include: { storedObject: true },
  });
}

export async function removeQuoteMedia(workspaceId: string, quoteId: string, mediaId: string) {
  const media = await prisma.quoteMedia.findFirst({ where: { id: mediaId, quoteId, workspaceId }, include: { storedObject: true } });
  if (!media) throw new NotFoundError("File not found");
  await prisma.quoteMedia.delete({ where: { id: mediaId } });
  return media;
}

// ---------------------------------------------------------------------------
// Pricing and items
// ---------------------------------------------------------------------------

export const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1, "Description is required").max(300),
  customerDescription: z.string().trim().max(600).optional().or(z.literal("")).nullable(),
  quantity: z.union([z.string(), z.number()]).transform((v) => parseQuantity(v)),
  unit: z.enum(["HOUR", "DAY", "ITEM", "METRE", "SQUARE_METRE", "VISIT", "FIXED"]),
  kind: z.enum(["LABOUR", "MATERIAL", "OTHER"]),
  unitPriceMinor: z.coerce.number().int().min(0, "Price cannot be negative").max(1_000_000_000),
  discountType: z.enum(["NONE", "FIXED", "PERCENT"]).default("NONE"),
  discountValue: z.coerce.number().int().min(0).default(0),
  taxTreatment: z.enum(["TAXABLE", "EXEMPT"]).default("TAXABLE"),
  internalCostMinor: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  catalogueItemId: z.string().uuid().nullable().optional(),
  isOptional: z.coerce.boolean().default(false),
  aiSuggested: z.coerce.boolean().default(false),
});
export type LineItemInput = z.infer<typeof lineItemSchema>;

export const pricingSettingsSchema = z.object({
  pricingMode: z.enum(["TAX_EXCLUSIVE", "TAX_INCLUSIVE", "NO_TAX"]),
  taxRateBps: z.coerce.number().int().min(0).max(10000),
  taxLabel: z.string().trim().min(1).max(30),
  discountType: z.enum(["NONE", "FIXED", "PERCENT"]),
  discountValue: z.coerce.number().int().min(0),
  callOutFeeMinor: z.coerce.number().int().min(0).max(1_000_000_000),
  callOutFeeLabel: z.string().trim().max(60).default("Call-out fee"),
  depositTerms: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
  internalNotes: z.string().trim().max(4000).optional().or(z.literal("")).nullable(),
});
export type PricingSettingsInput = z.infer<typeof pricingSettingsSchema>;

export async function saveLineItems(workspaceId: string, quoteId: string, userId: string | null, items: LineItemInput[], pricing: PricingSettingsInput) {
  const quote = await getQuote(workspaceId, quoteId);
  if (!quote.currentVersion || quote.currentVersion.isLocked) throw new AppError("This version is locked. Create a revision to change pricing.");
  if (!isEditable(quote.status)) throw new AppError("This quote can no longer be edited.");
  if (items.length > 100) throw new AppError("A quote can contain at most 100 line items.");
  const catalogueIds = items.map((i) => i.catalogueItemId).filter((id): id is string => !!id);
  if (catalogueIds.length > 0) {
    const valid = await prisma.serviceCatalogueItem.findMany({ where: { id: { in: catalogueIds }, workspaceId }, select: { id: true } });
    const validSet = new Set(valid.map((v) => v.id));
    for (const item of items) if (item.catalogueItemId && !validSet.has(item.catalogueItemId)) item.catalogueItemId = null;
  }
  const effectivePricingMode = pricing.pricingMode;
  const taxRate = effectivePricingMode === "NO_TAX" ? 0 : pricing.taxRateBps;
  const result = calculateQuote({
    lines: items.map((i) => ({ quantity: i.quantity, unitPriceMinor: i.unitPriceMinor, discountType: i.discountType, discountValue: i.discountValue, taxTreatment: i.taxTreatment, internalCostMinor: i.internalCostMinor, isOptional: i.isOptional })),
    pricingMode: effectivePricingMode,
    taxRateBps: taxRate,
    discountType: pricing.discountType,
    discountValue: pricing.discountValue,
    callOutFeeMinor: pricing.callOutFeeMinor,
  });
  const versionId = quote.currentVersion.id;
  await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { versionId } });
    if (items.length > 0) {
      await tx.quoteItem.createMany({
        data: items.map((i, idx) => ({
          workspaceId,
          versionId,
          catalogueItemId: i.catalogueItemId ?? null,
          sortOrder: idx,
          kind: i.kind,
          description: i.description,
          customerDescription: i.customerDescription || null,
          quantity: i.quantity,
          unit: i.unit,
          unitPriceMinor: i.unitPriceMinor,
          discountType: i.discountType,
          discountValue: i.discountValue,
          taxTreatment: i.taxTreatment,
          internalCostMinor: i.internalCostMinor,
          lineSubtotalMinor: result.lines[idx]!.lineSubtotalMinor,
          lineDiscountMinor: result.lines[idx]!.lineDiscountMinor,
          lineTotalMinor: result.lines[idx]!.lineTotalMinor,
          isOptional: i.isOptional,
          aiSuggested: i.aiSuggested,
        })),
      });
    }
    await tx.quoteVersion.update({
      where: { id: versionId },
      data: {
        pricingMode: effectivePricingMode,
        taxRateBps: taxRate,
        taxLabel: pricing.taxLabel,
        discountType: pricing.discountType,
        discountValue: pricing.discountValue,
        callOutFeeMinor: pricing.callOutFeeMinor,
        callOutFeeLabel: pricing.callOutFeeLabel || "Call-out fee",
        depositTerms: pricing.depositTerms || null,
        subtotalMinor: result.subtotalMinor,
        discountMinor: result.discountMinor,
        taxMinor: result.taxMinor,
        totalMinor: result.totalMinor,
        internalCostMinor: result.internalCostMinor,
      },
    });
    await tx.quote.update({ where: { id: quoteId }, data: { totalMinor: result.totalMinor, internalNotes: pricing.internalNotes === undefined ? undefined : pricing.internalNotes || null, wizardStep: Math.max(quote.wizardStep, 4), pdfObjectId: null } });
    await addQuoteEvent(tx, { workspaceId, quoteId, type: "UPDATED", actorUserId: userId, message: "Pricing updated", metadata: { totalMinor: result.totalMinor, items: items.length } });
  });
  return result;
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

export const wordingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  jobSummary: z.string().trim().max(2000).optional().or(z.literal("")),
  scopeOfWork: z.string().trim().max(6000).optional().or(z.literal("")),
  includedWork: z.string().trim().max(4000).optional().or(z.literal("")),
  assumptions: z.string().trim().max(4000).optional().or(z.literal("")),
  exclusions: z.string().trim().max(4000).optional().or(z.literal("")),
  customerResponsibilities: z.string().trim().max(3000).optional().or(z.literal("")),
  paymentTerms: z.string().trim().max(2000).optional().or(z.literal("")),
  estimatedSchedule: z.string().trim().max(1500).optional().or(z.literal("")),
  warrantyWording: z.string().trim().max(2000).optional().or(z.literal("")),
  validityWording: z.string().trim().max(800).optional().or(z.literal("")),
  followUpEmail: z.string().trim().max(4000).optional().or(z.literal("")),
  customerNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  customerQuestions: z.array(z.string().trim().max(300)).max(20).optional(),
});
export type WordingInput = z.infer<typeof wordingSchema>;

export async function saveWording(workspaceId: string, quoteId: string, userId: string | null, input: Partial<WordingInput>) {
  const quote = await getQuote(workspaceId, quoteId);
  if (!quote.currentVersion || quote.currentVersion.isLocked) throw new AppError("This version is locked. Create a revision to change wording.");
  if (!isEditable(quote.status)) throw new AppError("This quote can no longer be edited.");
  const data: Prisma.QuoteVersionUpdateInput = {};
  const keys = ["jobSummary", "scopeOfWork", "includedWork", "assumptions", "exclusions", "customerResponsibilities", "paymentTerms", "estimatedSchedule", "warrantyWording", "validityWording", "followUpEmail", "customerNotes"] as const;
  for (const key of keys) {
    if (input[key] !== undefined) (data as Record<string, unknown>)[key] = nul(input[key]);
  }
  if (input.title !== undefined && input.title.trim()) data.title = input.title.trim();
  if (input.customerQuestions !== undefined) data.customerQuestions = input.customerQuestions.filter((q) => q.trim());
  await prisma.$transaction([
    prisma.quoteVersion.update({ where: { id: quote.currentVersion.id }, data }),
    prisma.quote.update({ where: { id: quoteId }, data: { title: data.title ? (data.title as string) : undefined, wizardStep: Math.max(quote.wizardStep, 5), pdfObjectId: null } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "UPDATED", actorUserId: userId, message: "Wording updated" }),
  ]);
}

// ---------------------------------------------------------------------------
// Status changes and lifecycle
// ---------------------------------------------------------------------------

export async function markReady(workspaceId: string, quoteId: string, userId: string | null) {
  const quote = await getQuote(workspaceId, quoteId);
  assertTransition(quote.status, "READY");
  if (!quote.customerId) throw new AppError("Choose a customer before marking the quote ready.");
  if ((quote.currentVersion?.items.length ?? 0) === 0) throw new AppError("Add at least one line item before marking the quote ready.");
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: "READY", readyAt: new Date(), wizardStep: 6 } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "READY", actorUserId: userId, message: "Marked ready to send" }),
  ]);
}

export async function archiveQuote(workspaceId: string, quoteId: string, userId: string | null) {
  const quote = await getQuote(workspaceId, quoteId);
  assertTransition(quote.status, "ARCHIVED");
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: "ARCHIVED", archivedAt: new Date() } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "ARCHIVED", actorUserId: userId, message: "Quote archived", metadata: { previousStatus: quote.status } }),
  ]);
}

export async function bulkArchiveQuotes(workspaceId: string, quoteIds: string[], userId: string | null): Promise<number> {
  let count = 0;
  for (const id of quoteIds.slice(0, 200)) {
    try {
      await archiveQuote(workspaceId, id, userId);
      count++;
    } catch {
      // Skip quotes that cannot be archived (e.g. already archived or not in workspace).
    }
  }
  return count;
}

export async function restoreQuote(workspaceId: string, quoteId: string, userId: string | null) {
  const quote = await getQuote(workspaceId, quoteId);
  if (quote.status !== "ARCHIVED") throw new AppError("Only archived quotes can be restored.");
  const lastEvent = await prisma.quoteEvent.findFirst({ where: { quoteId, type: "ARCHIVED" }, orderBy: { createdAt: "desc" } });
  const previous = ((lastEvent?.metadata as { previousStatus?: QuoteStatus } | null)?.previousStatus ?? "DRAFT") as QuoteStatus;
  const target: QuoteStatus = previous === "ARCHIVED" ? "DRAFT" : previous;
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: target, archivedAt: null } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "RESTORED", actorUserId: userId, message: `Restored to ${target.toLowerCase()}` }),
  ]);
}

/** Reactivates an expired quote by extending its expiry date. */
export async function reactivateQuote(workspaceId: string, quoteId: string, userId: string | null, newExpiry: Date) {
  const quote = await getQuote(workspaceId, quoteId);
  if (quote.status !== "EXPIRED") throw new AppError("Only expired quotes can be reactivated.");
  if (newExpiry <= new Date()) throw new AppError("The new expiry date must be in the future.");
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: "SENT", expiresAt: newExpiry, expiredAt: null, reminderSentAt: null } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "REACTIVATED", actorUserId: userId, message: "Quote reactivated with a new expiry date", metadata: { expiresAt: newExpiry.toISOString() } }),
  ]);
}

export async function returnToDraft(workspaceId: string, quoteId: string, userId: string | null) {
  const quote = await getQuote(workspaceId, quoteId);
  assertTransition(quote.status, "DRAFT");
  if (quote.currentVersion?.isLocked) throw new AppError("This version is locked. Create a revision instead.");
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: "DRAFT" } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "UPDATED", actorUserId: userId, message: "Returned to draft", metadata: { previousStatus: quote.status } }),
  ]);
}

/**
 * Creates a new version by copying the current one. If the current version is
 * accepted it stays locked and preserved; the quote returns to draft with the
 * new version as the editable one.
 */
export async function createRevision(workspaceId: string, quoteId: string, userId: string | null): Promise<{ versionId: string; versionNumber: number }> {
  const quote = await getQuote(workspaceId, quoteId);
  const current = quote.currentVersion;
  if (!current) throw new AppError("Quote has no version to revise.");
  if (quote.status === "ARCHIVED") throw new AppError("Restore the quote before creating a revision.");
  const nextNumber = (quote.versions[0]?.versionNumber ?? current.versionNumber) + 1;
  return prisma.$transaction(async (tx) => {
    const { id: _id, items, createdAt: _c, updatedAt: _u, versionNumber: _v, isLocked: _l, lockedAt: _la, quoteId: _q, workspaceId: _w, ...rest } = current;
    const version = await tx.quoteVersion.create({
      data: {
        ...rest,
        customerQuestions: rest.customerQuestions ?? undefined,
        workspaceId,
        quoteId,
        versionNumber: nextNumber,
        items: {
          create: items.map(({ id: _iid, versionId: _vid, createdAt: _ic, updatedAt: _iu, workspaceId: _iw, catalogueItem: _ci, ...item }) => ({ ...item, workspaceId })),
        },
      },
      select: { id: true },
    });
    await tx.quote.update({ where: { id: quoteId }, data: { currentVersionId: version.id, status: "DRAFT", acceptedAt: null, declinedAt: null, expiredAt: null, pdfObjectId: null, wizardStep: 4 } });
    await addQuoteEvent(tx, { workspaceId, quoteId, type: "REVISION_CREATED", actorUserId: userId, message: `Revision ${nextNumber} created`, metadata: { fromVersion: current.versionNumber, toVersion: nextNumber, previousStatus: quote.status } });
    return { versionId: version.id, versionNumber: nextNumber };
  });
}

export async function duplicateQuote(workspaceId: string, quoteId: string, userId: string | null): Promise<{ id: string; number: string }> {
  const source = await getQuote(workspaceId, quoteId);
  const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId } });
  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const number = await allocateQuoteNumber(tx, workspaceId, settings.quoteNumberPrefix, now);
    const quote = await tx.quote.create({
      data: {
        workspaceId,
        customerId: source.customerId,
        templateId: source.templateId,
        createdById: userId,
        number,
        title: source.title,
        currency: source.currency,
        expiresAt: addDays(now, settings.quoteValidityDays),
        jobAddressLine1: source.jobAddressLine1,
        jobAddressLine2: source.jobAddressLine2,
        jobCity: source.jobCity,
        jobRegion: source.jobRegion,
        jobPostalCode: source.jobPostalCode,
        jobCountry: source.jobCountry,
        enquiryText: source.enquiryText,
        jobNotes: source.jobNotes,
        transcript: source.transcript,
        internalNotes: source.internalNotes,
        aiAnalysis: source.aiAnalysis ?? undefined,
        duplicatedFromId: source.id,
        totalMinor: source.currentVersion?.totalMinor ?? 0,
        wizardStep: 4,
      },
      select: { id: true, number: true },
    });
    if (source.currentVersion) {
      const { id: _id, items, createdAt: _c, updatedAt: _u, isLocked: _l, lockedAt: _la, quoteId: _q, workspaceId: _w, versionNumber: _v, ...rest } = source.currentVersion;
      const version = await tx.quoteVersion.create({
        data: {
          ...rest,
          customerQuestions: rest.customerQuestions ?? undefined,
          workspaceId,
          quoteId: quote.id,
          versionNumber: 1,
          items: { create: items.map(({ id: _iid, versionId: _vid, createdAt: _ic, updatedAt: _iu, workspaceId: _iw, catalogueItem: _ci, ...item }) => ({ ...item, workspaceId })) },
        },
        select: { id: true },
      });
      await tx.quote.update({ where: { id: quote.id }, data: { currentVersionId: version.id } });
    }
    await addQuoteEvent(tx, { workspaceId, quoteId: quote.id, type: "DUPLICATED", actorUserId: userId, message: `Duplicated from ${source.number}`, metadata: { sourceQuoteId: source.id } });
    return quote;
  });
  return created;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface QuoteListParams {
  search?: string;
  status?: QuoteStatus | "ALL" | "OPEN";
  customerId?: string;
  from?: string | null;
  to?: string | null;
  sort?: "newest" | "oldest" | "value_desc" | "value_asc" | "expiry";
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
}

export async function listQuotes(workspaceId: string, params: QuoteListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const where: Prisma.QuoteWhereInput = {
    workspaceId,
    deletedAt: null,
    status:
      params.status === "ALL"
        ? params.includeArchived ? undefined : { not: "ARCHIVED" }
        : params.status === "OPEN"
          ? { in: ["SENT", "VIEWED"] }
          : params.status ?? { not: "ARCHIVED" },
    customerId: params.customerId || undefined,
    createdAt: params.from || params.to ? { gte: params.from ? new Date(`${params.from}T00:00:00.000Z`) : undefined, lte: params.to ? new Date(`${params.to}T23:59:59.999Z`) : undefined } : undefined,
    OR: params.search
      ? [
          { number: { contains: params.search, mode: "insensitive" } },
          { title: { contains: params.search, mode: "insensitive" } },
          { reference: { contains: params.search, mode: "insensitive" } },
          { customer: { contactName: { contains: params.search, mode: "insensitive" } } },
          { customer: { companyName: { contains: params.search, mode: "insensitive" } } },
        ]
      : undefined,
  };
  const orderBy: Prisma.QuoteOrderByWithRelationInput =
    params.sort === "oldest" ? { createdAt: "asc" } : params.sort === "value_desc" ? { totalMinor: "desc" } : params.sort === "value_asc" ? { totalMinor: "asc" } : params.sort === "expiry" ? { expiresAt: "asc" } : { createdAt: "desc" };
  const [items, total] = await Promise.all([
    prisma.quote.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: { customer: { select: { id: true, contactName: true, companyName: true } } } }),
    prisma.quote.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
