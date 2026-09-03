import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getQuote } from "@/lib/services/quotes";
import { buildQuoteDocument } from "@/lib/services/quote-document";
import { ensurePublicLink } from "@/lib/services/public-quote";
import { activeCatalogueForAi } from "@/lib/services/catalogue";
import { signedDownloadUrl } from "@/lib/services/uploads";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { getFeatureFlags } from "@/lib/config/feature-flags";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { QuoteWizard } from "@/components/wizard/wizard";
import type { WizardData } from "@/components/wizard/types";
import type { EnquiryAnalysis } from "@/lib/ai/schemas";
import { toDateInputValue } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Quote wizard" };

export default async function QuoteEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireWorkspaceForPage(`/app/quotes/${id}/edit`);
  if (ctx.supportSession) redirect(`/app/quotes/${id}`);
  const quote = await getQuote(ctx.workspace.id, id).catch(() => null);
  if (!quote) notFound();
  if (quote.status === "ARCHIVED") redirect(`/app/quotes/${id}`);
  const requested = Number(sp.step ?? quote.wizardStep ?? 1);
  const step = Math.min(7, Math.max(1, Number.isFinite(requested) ? requested : 1));
  const [entitlements, flags, settings, site, catalogue, env] = await Promise.all([
    getWorkspaceEntitlements(ctx.workspace.id),
    getFeatureFlags(),
    prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId: ctx.workspace.id } }),
    getSiteSettings(),
    activeCatalogueForAi(ctx.workspace.id),
    Promise.resolve(getEnv()),
  ]);
  const media = await Promise.all(
    quote.media.map(async (m) => ({
      id: m.id,
      kind: m.kind,
      filename: m.storedObject.originalFilename ?? "file",
      mimeType: m.storedObject.mimeType,
      sizeBytes: m.storedObject.sizeBytes,
      previewUrl: m.kind === "IMAGE" ? await signedDownloadUrl(m.storedObject.id, { workspaceId: ctx.workspace.id }).catch(() => null) : null,
      transcript: m.transcript,
    })),
  );
  const v = quote.currentVersion;
  const data: WizardData = {
    quote: {
      id: quote.id,
      number: quote.number,
      status: quote.status,
      title: quote.title,
      reference: quote.reference ?? "",
      expiresAt: toDateInputValue(quote.expiresAt),
      currency: quote.currency,
      jobAddressLine1: quote.jobAddressLine1 ?? "",
      jobAddressLine2: quote.jobAddressLine2 ?? "",
      jobCity: quote.jobCity ?? "",
      jobRegion: quote.jobRegion ?? "",
      jobPostalCode: quote.jobPostalCode ?? "",
      jobCountry: quote.jobCountry ?? "",
      enquiryText: quote.enquiryText ?? "",
      jobNotes: quote.jobNotes ?? "",
      transcript: quote.transcript ?? "",
      wizardStep: quote.wizardStep,
      isLocked: v?.isLocked ?? false,
      sentAt: quote.sentAt?.toISOString() ?? null,
      followUpAt: quote.followUpAt?.toISOString() ?? null,
      totalMinor: quote.totalMinor,
      hasPublicLink: !!quote.publicTokenHash,
    },
    customer: quote.customer ? { id: quote.customer.id, contactName: quote.customer.contactName, companyName: quote.customer.companyName, email: quote.customer.email, phone: quote.customer.phone, jobAddressLine1: quote.customer.jobAddressLine1, jobCity: quote.customer.jobCity, jobPostalCode: quote.customer.jobPostalCode } : null,
    media,
    analysis: (quote.aiAnalysis as EnquiryAnalysis | null) ?? null,
    items: (v?.items ?? []).map((i) => ({
      id: i.id,
      clientId: i.id,
      description: i.description,
      customerDescription: i.customerDescription ?? "",
      quantity: i.quantity.toString(),
      unit: i.unit,
      kind: i.kind,
      unitPriceMinor: i.unitPriceMinor,
      discountType: i.discountType,
      discountValue: i.discountValue,
      taxTreatment: i.taxTreatment,
      internalCostMinor: i.internalCostMinor,
      catalogueItemId: i.catalogueItemId,
      isOptional: i.isOptional,
      aiSuggested: i.aiSuggested,
    })),
    pricing: {
      pricingMode: v?.pricingMode ?? settings.pricingMode,
      taxRateBps: v?.taxRateBps ?? settings.taxRateBps,
      taxLabel: v?.taxLabel ?? settings.taxLabel,
      discountType: v?.discountType ?? "NONE",
      discountValue: v?.discountValue ?? 0,
      callOutFeeMinor: v?.callOutFeeMinor ?? 0,
      callOutFeeLabel: v?.callOutFeeLabel ?? "Call-out fee",
      depositTerms: v?.depositTerms ?? "",
      internalNotes: quote.internalNotes ?? "",
    },
    wording: {
      title: v?.title ?? quote.title,
      jobSummary: v?.jobSummary ?? "",
      scopeOfWork: v?.scopeOfWork ?? "",
      includedWork: v?.includedWork ?? "",
      assumptions: v?.assumptions ?? "",
      exclusions: v?.exclusions ?? "",
      customerResponsibilities: v?.customerResponsibilities ?? "",
      paymentTerms: v?.paymentTerms ?? "",
      estimatedSchedule: v?.estimatedSchedule ?? "",
      warrantyWording: v?.warrantyWording ?? "",
      validityWording: v?.validityWording ?? "",
      followUpEmail: v?.followUpEmail ?? "",
      customerNotes: v?.customerNotes ?? "",
      customerQuestions: Array.isArray(v?.customerQuestions) ? (v!.customerQuestions as string[]) : [],
    },
    settings: { defaultTaxRateBps: settings.taxRateBps, taxLabel: settings.taxLabel, pricingMode: settings.pricingMode, callOutFeeMinor: settings.callOutFeeMinor, labourRateMinor: settings.labourRateMinor, quoteValidityDays: settings.quoteValidityDays, country: settings.country },
    entitlements: { aiAvailable: entitlements.totalAvailable, isTrial: entitlements.isTrial, canSendEmail: entitlements.features.ACCEPTANCE_LINKS, canPdf: entitlements.features.PDF_DOWNLOAD, canAcceptanceLinks: entitlements.features.ACCEPTANCE_LINKS },
    flags: { voice: flags.voice_recording, photos: flags.photo_analysis, email: flags.email_sending },
    limits: { maxImageMb: site["app.maxImageMb"], maxAudioMb: site["app.maxAudioMb"], maxDocumentMb: site["app.maxDocumentMb"], maxImages: site["app.maxImagesPerQuote"], imageTypes: site["app.allowedImageTypes"], audioTypes: site["app.allowedAudioTypes"], documentTypes: site["app.allowedDocumentTypes"] },
    aiProvider: env.providers.ai,
    emailPreviewMode: env.providers.email === "preview",
  };
  const document = step === 6 ? await buildQuoteDocument(ctx.workspace.id, quote.id) : null;
  const publicUrl = step === 7 && ["SENT", "VIEWED"].includes(quote.status) ? (await ensurePublicLink(ctx.workspace.id, quote.id)).url : null;
  return <QuoteWizard data={data} step={step} catalogue={catalogue.map((c) => ({ id: c.id, name: c.name, category: c.category }))} document={document} publicUrl={publicUrl} isAdmin={ctx.isAdmin} />;
}
