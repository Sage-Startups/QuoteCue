import type { EnquiryAnalysis } from "@/lib/ai/schemas";
import type { Currency, DiscountType, ItemKind, PricingMode, QuoteStatus, ServiceUnit, TaxTreatment } from "@/generated/prisma/enums";

export interface WizardCustomer {
  id: string;
  contactName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  jobAddressLine1: string | null;
  jobCity: string | null;
  jobPostalCode: string | null;
}

export interface WizardMedia {
  id: string;
  kind: "IMAGE" | "AUDIO" | "DOCUMENT";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
  transcript: string | null;
}

export interface WizardLineItem {
  id: string;
  clientId: string;
  description: string;
  customerDescription: string;
  quantity: string;
  unit: ServiceUnit;
  kind: ItemKind;
  unitPriceMinor: number;
  discountType: DiscountType;
  discountValue: number;
  taxTreatment: TaxTreatment;
  internalCostMinor: number;
  catalogueItemId: string | null;
  isOptional: boolean;
  aiSuggested: boolean;
  unpriced?: boolean;
}

export interface WizardPricing {
  pricingMode: PricingMode;
  taxRateBps: number;
  taxLabel: string;
  discountType: DiscountType;
  discountValue: number;
  callOutFeeMinor: number;
  callOutFeeLabel: string;
  depositTerms: string;
  internalNotes: string;
}

export interface WizardWording {
  title: string;
  jobSummary: string;
  scopeOfWork: string;
  includedWork: string;
  assumptions: string;
  exclusions: string;
  customerResponsibilities: string;
  paymentTerms: string;
  estimatedSchedule: string;
  warrantyWording: string;
  validityWording: string;
  followUpEmail: string;
  customerNotes: string;
  customerQuestions: string[];
}

export interface WizardData {
  quote: {
    id: string;
    number: string;
    status: QuoteStatus;
    title: string;
    reference: string;
    expiresAt: string;
    currency: Currency;
    jobAddressLine1: string;
    jobAddressLine2: string;
    jobCity: string;
    jobRegion: string;
    jobPostalCode: string;
    jobCountry: string;
    enquiryText: string;
    jobNotes: string;
    transcript: string;
    wizardStep: number;
    isLocked: boolean;
    sentAt: string | null;
    followUpAt: string | null;
    totalMinor: number;
    hasPublicLink: boolean;
  };
  customer: WizardCustomer | null;
  media: WizardMedia[];
  analysis: EnquiryAnalysis | null;
  items: WizardLineItem[];
  pricing: WizardPricing;
  wording: WizardWording;
  settings: { defaultTaxRateBps: number; taxLabel: string; pricingMode: PricingMode; callOutFeeMinor: number; labourRateMinor: number; quoteValidityDays: number; country: string };
  entitlements: { aiAvailable: number; isTrial: boolean; canSendEmail: boolean; canPdf: boolean; canAcceptanceLinks: boolean };
  flags: { voice: boolean; photos: boolean; email: boolean };
  limits: { maxImageMb: number; maxAudioMb: number; maxDocumentMb: number; maxImages: number; imageTypes: string[]; audioTypes: string[]; documentTypes: string[] };
  aiProvider: "openai" | "mock";
  emailPreviewMode: boolean;
}

export const WIZARD_STEPS = [
  { step: 1, key: "customer", title: "Customer", short: "Customer" },
  { step: 2, key: "enquiry", title: "Capture the enquiry", short: "Enquiry" },
  { step: 3, key: "analysis", title: "AI analysis", short: "Analysis" },
  { step: 4, key: "pricing", title: "Price the work", short: "Pricing" },
  { step: 5, key: "wording", title: "Generate wording", short: "Wording" },
  { step: 6, key: "review", title: "Review", short: "Review" },
  { step: 7, key: "confirmation", title: "Confirmation", short: "Done" },
] as const;
