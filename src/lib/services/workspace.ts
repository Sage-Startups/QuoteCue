import { z } from "zod";
import type { Currency, PricingMode, ServiceUnit, TaxMode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/config/site-settings";
import { grantCredits } from "@/lib/billing/credits";
import { ensureSubscription } from "@/lib/billing/entitlements";
import { TRADE_TEMPLATES, findTradeTemplate } from "@/lib/data/trade-templates";
import { slugify } from "@/lib/utils/strings";
import { trackEvent } from "./app-events";

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name").max(80),
  businessName: z.string().trim().min(2, "Please enter your business name").max(120),
  tradeSlug: z.string().min(1, "Please choose your trade"),
  addressLine1: z.string().trim().max(120).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  region: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().length(2, "Use a two-letter country code").default("GB"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  website: z.string().trim().max(120).optional().or(z.literal("")),
  currency: z.enum(["USD", "GBP", "EUR", "CAD", "AUD", "NZD"]),
  taxMode: z.enum(["NONE", "VAT", "GST", "SALES_TAX", "CUSTOM"]),
  taxLabel: z.string().trim().max(30).optional().or(z.literal("")),
  taxRatePercent: z.coerce.number().min(0).max(100),
  pricingMode: z.enum(["TAX_EXCLUSIVE", "TAX_INCLUSIVE", "NO_TAX"]),
  labourRate: z.coerce.number().min(0).max(100000),
  labourRateUnit: z.enum(["HOUR", "DAY"]),
  callOutFee: z.coerce.number().min(0).max(100000),
  paymentTerms: z.string().trim().min(5).max(1500),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0f1f3d"),
  logoObjectId: z.string().uuid().optional().or(z.literal("")),
  includeCatalogue: z.coerce.boolean().default(true),
  createSampleQuote: z.coerce.boolean().default(true),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export function taxLabelFor(mode: TaxMode, custom?: string | null): string {
  switch (mode) {
    case "VAT":
      return "VAT";
    case "GST":
      return "GST";
    case "SALES_TAX":
      return "Sales tax";
    case "CUSTOM":
      return custom?.trim() || "Tax";
    default:
      return "Tax";
  }
}

export async function uniqueWorkspaceSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let i = 2;
  while (await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${root}-${i++}`;
  }
  return candidate;
}

/**
 * Creates the workspace, business settings, subscription, trial credits and
 * starter catalogue in a single transaction. Returns the workspace id.
 */
export async function createWorkspaceFromOnboarding(userId: string, input: OnboardingInput): Promise<{ workspaceId: string }> {
  const settings = await getSiteSettings();
  const trade = findTradeTemplate(input.tradeSlug);
  const slug = await uniqueWorkspaceSlug(input.businessName);
  const currency = input.currency as Currency;
  const taxMode = input.taxMode as TaxMode;
  const pricingMode: PricingMode = taxMode === "NONE" ? "NO_TAX" : (input.pricingMode as PricingMode);
  const trialCredits = settings["app.trialCredits"];

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: input.businessName,
        slug,
        ownerId: userId,
        members: { create: { userId, role: "ADMIN" } },
        settings: {
          create: {
            businessName: input.businessName,
            tradeSlug: trade.slug,
            contactName: input.fullName,
            email: input.email || null,
            phone: input.phone || null,
            website: input.website || null,
            addressLine1: input.addressLine1 || null,
            addressLine2: input.addressLine2 || null,
            city: input.city || null,
            region: input.region || null,
            postalCode: input.postalCode || null,
            country: input.country.toUpperCase(),
            currency,
            taxMode,
            taxLabel: taxLabelFor(taxMode, input.taxLabel),
            taxRateBps: taxMode === "NONE" ? 0 : Math.round(input.taxRatePercent * 100),
            pricingMode,
            labourRateMinor: Math.round(input.labourRate * 100),
            labourRateUnit: input.labourRateUnit as ServiceUnit,
            callOutFeeMinor: Math.round(input.callOutFee * 100),
            paymentTerms: input.paymentTerms,
            warrantyWording: "Our workmanship is guaranteed for 12 months from completion. Manufacturer warranties apply to supplied materials.",
            quoteValidityDays: input.quoteValidityDays,
            brandColor: input.brandColor,
            logoObjectId: input.logoObjectId || null,
          },
        },
        quoteTemplates: {
          create: {
            name: `${trade.name} standard quote`,
            tradeSlug: trade.slug,
            description: "Default wording created from your trade template. Edit it any time.",
            scopeOfWork: trade.defaultScope,
            exclusions: trade.commonExclusions.map((e) => `- ${e}`).join("\n"),
            assumptions: trade.defaultAssumptions.map((a) => `- ${a}`).join("\n"),
            customerQuestions: trade.commonQuestions,
            paymentTerms: trade.defaultTerms,
            warrantyWording: "Our workmanship is guaranteed for 12 months from completion.",
            isDefault: true,
          },
        },
      },
      select: { id: true },
    });

    if (input.includeCatalogue) {
      let order = 0;
      await tx.serviceCatalogueItem.createMany({
        data: trade.suggestedServices.map((s) => ({
          workspaceId: ws.id,
          name: s.name,
          category: s.category,
          description: s.description ?? null,
          customerDescription: s.customerDescription ?? null,
          unit: s.unit,
          kind: s.kind,
          unitPriceMinor: s.name.toLowerCase().includes("labour") && s.unit === input.labourRateUnit ? Math.round(input.labourRate * 100) : s.unitPriceMinor,
          internalCostMinor: s.internalCostMinor,
          taxTreatment: "TAXABLE",
          sortOrder: order++,
        })),
      });
    }

    if (input.logoObjectId) {
      await tx.storedObject.updateMany({ where: { id: input.logoObjectId, workspaceId: null }, data: { workspaceId: ws.id } });
    }
    return ws;
  });

  await ensureSubscription(workspace.id);
  if (trialCredits > 0) {
    await grantCredits({
      workspaceId: workspace.id,
      amount: trialCredits,
      type: "TRIAL_GRANT",
      reason: "Free trial AI generations",
      userId,
      idempotencyKey: `trial:${workspace.id}`,
    });
  }
  await prisma.user.update({ where: { id: userId }, data: { name: input.fullName, onboardingCompletedAt: new Date() } });
  await trackEvent({ name: "onboarding_completed", userId, workspaceId: workspace.id, properties: { trade: trade.slug, currency } });
  return { workspaceId: workspace.id };
}

export const businessSettingsSchema = onboardingSchema
  .omit({ fullName: true, includeCatalogue: true, createSampleQuote: true, logoObjectId: true })
  .extend({
    depositTerms: z.string().trim().max(1000).optional().or(z.literal("")),
    warrantyWording: z.string().trim().max(1500).optional().or(z.literal("")),
    quoteFooter: z.string().trim().max(600).optional().or(z.literal("")),
    quoteNumberPrefix: z.string().trim().regex(/^[A-Z0-9]{1,6}$/i, "Use up to six letters or numbers").default("QC"),
    taxNumber: z.string().trim().max(40).optional().or(z.literal("")),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour").default("#d97706"),
    contactName: z.string().trim().max(80).optional().or(z.literal("")),
  });
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;

export async function updateBusinessSettings(workspaceId: string, input: BusinessSettingsInput): Promise<void> {
  const taxMode = input.taxMode as TaxMode;
  await prisma.$transaction([
    prisma.businessSettings.update({
      where: { workspaceId },
      data: {
        businessName: input.businessName,
        tradeSlug: findTradeTemplate(input.tradeSlug).slug,
        contactName: input.contactName || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        addressLine1: input.addressLine1 || null,
        addressLine2: input.addressLine2 || null,
        city: input.city || null,
        region: input.region || null,
        postalCode: input.postalCode || null,
        country: input.country.toUpperCase(),
        currency: input.currency as Currency,
        taxMode,
        taxLabel: taxLabelFor(taxMode, input.taxLabel),
        taxRateBps: taxMode === "NONE" ? 0 : Math.round(input.taxRatePercent * 100),
        taxNumber: input.taxNumber || null,
        pricingMode: taxMode === "NONE" ? "NO_TAX" : (input.pricingMode as PricingMode),
        labourRateMinor: Math.round(input.labourRate * 100),
        labourRateUnit: input.labourRateUnit as ServiceUnit,
        callOutFeeMinor: Math.round(input.callOutFee * 100),
        paymentTerms: input.paymentTerms,
        depositTerms: input.depositTerms || null,
        warrantyWording: input.warrantyWording || null,
        quoteValidityDays: input.quoteValidityDays,
        quoteNumberPrefix: input.quoteNumberPrefix.toUpperCase(),
        quoteFooter: input.quoteFooter || null,
        brandColor: input.brandColor,
        accentColor: input.accentColor,
      },
    }),
    prisma.workspace.update({ where: { id: workspaceId }, data: { name: input.businessName } }),
  ]);
}

export async function setWorkspaceLogo(workspaceId: string, storedObjectId: string | null): Promise<void> {
  if (storedObjectId) {
    const obj = await prisma.storedObject.findFirst({ where: { id: storedObjectId, workspaceId, purpose: "LOGO", deletedAt: null }, select: { id: true } });
    if (!obj) throw new Error("Logo upload not found for this workspace");
  }
  await prisma.businessSettings.update({ where: { workspaceId }, data: { logoObjectId: storedObjectId } });
}

export async function getBusinessSettings(workspaceId: string) {
  return prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId }, include: { logoObject: { select: { id: true, key: true, mimeType: true } } } });
}

export function tradeOptions() {
  return TRADE_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, description: t.description }));
}
