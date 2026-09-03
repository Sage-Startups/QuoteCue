import { z } from "zod";

/**
 * Zod schemas for every AI output. These are used both to request structured
 * output from the provider and to validate the response before anything is
 * stored. Structured outputs require every field to be present, so optional
 * information is modelled as nullable.
 */

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export const sourceSchema = z.enum(["message", "notes", "voice", "photo", "document", "inference"]);

export const suggestedWorkItemSchema = z.object({
  description: z.string().min(1).max(300),
  detail: z.string().max(600).nullable(),
  source: sourceSchema,
  confidence: confidenceSchema,
  requiresConfirmation: z.boolean(),
  kind: z.enum(["LABOUR", "MATERIAL", "OTHER"]),
  matchedCatalogueItemId: z.string().nullable(),
  matchedCatalogueItemName: z.string().nullable(),
  matchConfidence: confidenceSchema.nullable(),
  quantity: z.number().min(0).max(100000).nullable(),
  quantitySource: z.enum(["explicit", "estimated", "unknown"]),
  unit: z.enum(["HOUR", "DAY", "ITEM", "METRE", "SQUARE_METRE", "VISIT", "FIXED"]).nullable(),
});

export const uncertaintySchema = z.object({
  description: z.string().min(1).max(400),
  source: sourceSchema,
  confidence: confidenceSchema,
  requiresConfirmation: z.boolean(),
});

export const photoObservationSchema = z.object({
  mediaIndex: z.number().int().min(0).nullable(),
  observation: z.string().min(1).max(500),
  confidence: confidenceSchema,
  caveat: z.string().max(400).nullable(),
});

export const enquiryAnalysisSchema = z.object({
  jobSummary: z.string().min(1).max(1200),
  detectedTrade: z.string().max(60).nullable(),
  suggestedWork: z.array(suggestedWorkItemSchema).max(40),
  uncertainties: z.array(uncertaintySchema).max(30),
  missingInformation: z.array(z.string().max(300)).max(30),
  customerQuestions: z.array(z.string().max(300)).max(20),
  assumptions: z.array(z.string().max(300)).max(20),
  photoObservations: z.array(photoObservationSchema).max(40),
  safetyNotes: z.array(z.string().max(300)).max(10),
  recommendOnsiteInspection: z.boolean(),
  inspectionReason: z.string().max(400).nullable(),
  readiness: z.object({
    level: z.enum(["ready", "needs_confirmation", "needs_inspection"]),
    explanation: z.string().max(600),
  }),
});
export type EnquiryAnalysis = z.infer<typeof enquiryAnalysisSchema>;

export const quoteWordingSchema = z.object({
  title: z.string().min(1).max(120),
  jobSummary: z.string().min(1).max(1500),
  scopeOfWork: z.string().min(1).max(4000),
  includedWork: z.string().min(1).max(3000),
  assumptions: z.string().max(3000),
  exclusions: z.string().max(3000),
  customerResponsibilities: z.string().max(2000),
  paymentTerms: z.string().max(1500),
  estimatedSchedule: z.string().max(1000),
  warrantyWording: z.string().max(1500),
  validityWording: z.string().max(600),
  followUpEmail: z.string().min(1).max(3000),
  customerQuestions: z.array(z.string().max(300)).max(15),
});
export type QuoteWording = z.infer<typeof quoteWordingSchema>;

export const WORDING_SECTION_KEYS = [
  "title",
  "jobSummary",
  "scopeOfWork",
  "includedWork",
  "assumptions",
  "exclusions",
  "customerResponsibilities",
  "paymentTerms",
  "estimatedSchedule",
  "warrantyWording",
  "validityWording",
  "followUpEmail",
] as const;
export type WordingSectionKey = (typeof WORDING_SECTION_KEYS)[number];

export const sectionRegenerateSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type SectionRegenerate = z.infer<typeof sectionRegenerateSchema>;

export const imageAnalysisSchema = z.object({
  description: z.string().min(1).max(800),
  observations: z.array(photoObservationSchema).max(20),
  visibleIssues: z.array(z.string().max(300)).max(15),
  caveats: z.array(z.string().max(300)).max(10),
});
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;

export const promptTestSchema = z.object({
  output: z.string().max(6000),
});
