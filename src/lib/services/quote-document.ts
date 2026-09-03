import type { Currency, PricingMode, QuoteStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { readStoredObject, imageToDataUrl } from "./uploads";
import { customerDisplayName, formatAddress } from "./customers";
import { NotFoundError } from "@/lib/utils/result";

/**
 * A complete, customer-safe representation of a quote used by the web
 * preview, the public customer page and the PDF renderer. It never includes
 * internal notes, internal costs, margins or workspace-only files.
 */
export interface QuoteDocumentData {
  business: {
    name: string;
    contactName: string | null;
    addressLines: string[];
    phone: string | null;
    email: string | null;
    website: string | null;
    taxNumber: string | null;
    logoDataUrl: string | null;
    brandColor: string;
    accentColor: string;
    footer: string | null;
  };
  quote: {
    id: string;
    number: string;
    reference: string | null;
    title: string;
    status: QuoteStatus;
    versionNumber: number;
    issuedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    currency: Currency;
  };
  customer: {
    name: string;
    contactName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    billingAddress: string;
  } | null;
  jobAddress: string;
  sections: {
    jobSummary: string | null;
    scopeOfWork: string | null;
    includedWork: string | null;
    assumptions: string | null;
    exclusions: string | null;
    customerResponsibilities: string | null;
    paymentTerms: string | null;
    depositTerms: string | null;
    estimatedSchedule: string | null;
    warrantyWording: string | null;
    validityWording: string | null;
    customerNotes: string | null;
    customerQuestions: string[];
  };
  items: Array<{
    id: string;
    description: string;
    customerDescription: string | null;
    quantity: string;
    unit: string;
    unitPriceMinor: number;
    lineDiscountMinor: number;
    lineTotalMinor: number;
    kind: "LABOUR" | "MATERIAL" | "OTHER";
    isOptional: boolean;
  }>;
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    discountLabel: string | null;
    callOutFeeMinor: number;
    callOutFeeLabel: string;
    taxMinor: number;
    taxLabel: string;
    taxRateBps: number;
    totalMinor: number;
    pricingMode: PricingMode;
  };
  acceptance: { decision: "ACCEPTED" | "DECLINED"; signedName: string | null; reason: string | null; at: Date } | null;
  showQuoteCueBranding: boolean;
}

export async function buildQuoteDocument(workspaceId: string, quoteId: string, options: { versionId?: string; includeLogo?: boolean } = {}): Promise<QuoteDocumentData> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, workspaceId, deletedAt: null },
    include: {
      customer: true,
      currentVersion: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      acceptances: { orderBy: { createdAt: "desc" }, take: 1 },
      workspace: { include: { settings: { include: { logoObject: true } } } },
    },
  });
  if (!quote) throw new NotFoundError("Quote not found");
  const version = options.versionId
    ? await prisma.quoteVersion.findFirst({ where: { id: options.versionId, quoteId }, include: { items: { orderBy: { sortOrder: "asc" } } } })
    : quote.currentVersion;
  if (!version) throw new NotFoundError("Quote version not found");
  const settings = quote.workspace.settings;
  if (!settings) throw new NotFoundError("Business settings not found");
  const entitlements = await getWorkspaceEntitlements(workspaceId);

  let logoDataUrl: string | null = null;
  if (options.includeLogo !== false && settings.logoObject && entitlements.features.CUSTOM_LOGO) {
    const obj = await readStoredObject(settings.logoObject.id);
    if (obj) logoDataUrl = imageToDataUrl(obj.body, obj.mimeType);
  }
  const acceptance = quote.acceptances[0] && quote.acceptances[0].versionId === version.id ? quote.acceptances[0] : null;
  const discountLabel = version.discountType === "PERCENT" ? `Discount (${(version.discountValue / 100).toFixed(version.discountValue % 100 === 0 ? 0 : 1)}%)` : version.discountType === "FIXED" ? "Discount" : null;

  return {
    business: {
      name: settings.businessName,
      contactName: settings.contactName,
      addressLines: [settings.addressLine1, settings.addressLine2, [settings.city, settings.region].filter(Boolean).join(", "), settings.postalCode].filter((l): l is string => !!l && l.trim() !== ""),
      phone: settings.phone,
      email: settings.email,
      website: settings.website,
      taxNumber: settings.taxNumber,
      logoDataUrl,
      brandColor: entitlements.features.FULL_BRANDING ? settings.brandColor : "#0f1f3d",
      accentColor: entitlements.features.FULL_BRANDING ? settings.accentColor : "#d97706",
      footer: entitlements.features.FULL_BRANDING ? settings.quoteFooter : null,
    },
    quote: {
      id: quote.id,
      number: quote.number,
      reference: quote.reference,
      title: version.title,
      status: quote.status,
      versionNumber: version.versionNumber,
      issuedAt: quote.issuedAt ?? quote.sentAt,
      expiresAt: quote.expiresAt,
      createdAt: quote.createdAt,
      currency: quote.currency,
    },
    customer: quote.customer
      ? {
          name: customerDisplayName(quote.customer),
          contactName: quote.customer.contactName,
          companyName: quote.customer.companyName,
          email: quote.customer.email,
          phone: quote.customer.phone,
          billingAddress: formatAddress([quote.customer.billingAddressLine1, quote.customer.billingAddressLine2, quote.customer.billingCity, quote.customer.billingRegion, quote.customer.billingPostalCode]),
        }
      : null,
    jobAddress: formatAddress([quote.jobAddressLine1, quote.jobAddressLine2, quote.jobCity, quote.jobRegion, quote.jobPostalCode]),
    sections: {
      jobSummary: version.jobSummary,
      scopeOfWork: version.scopeOfWork,
      includedWork: version.includedWork,
      assumptions: version.assumptions,
      exclusions: version.exclusions,
      customerResponsibilities: version.customerResponsibilities,
      paymentTerms: version.paymentTerms,
      depositTerms: version.depositTerms,
      estimatedSchedule: version.estimatedSchedule,
      warrantyWording: version.warrantyWording,
      validityWording: version.validityWording,
      customerNotes: version.customerNotes,
      customerQuestions: Array.isArray(version.customerQuestions) ? (version.customerQuestions as string[]) : [],
    },
    items: version.items.map((i) => ({
      id: i.id,
      description: i.description,
      customerDescription: i.customerDescription,
      quantity: i.quantity.toString(),
      unit: i.unit,
      unitPriceMinor: i.unitPriceMinor,
      lineDiscountMinor: i.lineDiscountMinor,
      lineTotalMinor: i.lineTotalMinor,
      kind: i.kind,
      isOptional: i.isOptional,
    })),
    totals: {
      subtotalMinor: version.subtotalMinor,
      discountMinor: version.discountMinor,
      discountLabel,
      callOutFeeMinor: version.callOutFeeMinor,
      callOutFeeLabel: version.callOutFeeLabel,
      taxMinor: version.taxMinor,
      taxLabel: version.taxLabel,
      taxRateBps: version.taxRateBps,
      totalMinor: version.totalMinor,
      pricingMode: version.pricingMode,
    },
    acceptance: acceptance ? { decision: acceptance.decision, signedName: acceptance.signedName, reason: acceptance.reason, at: acceptance.createdAt } : null,
    showQuoteCueBranding: !entitlements.features.REMOVE_BRANDING,
  };
}
