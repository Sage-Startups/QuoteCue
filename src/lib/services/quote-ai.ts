import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { runStructuredAi, runTranscription, AiRunError } from "@/lib/ai/runner";
import { enquiryAnalysisSchema, quoteWordingSchema, sectionRegenerateSchema, type EnquiryAnalysis, type WordingSectionKey, WORDING_SECTION_KEYS } from "@/lib/ai/schemas";
import { assertCanGenerate } from "@/lib/billing/entitlements";
import { consumeGeneration, refundGeneration } from "@/lib/billing/credits";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { AppError } from "@/lib/utils/result";
import { findTradeTemplate } from "@/lib/data/trade-templates";
import { activeCatalogueForAi } from "./catalogue";
import { addQuoteEvent, getQuote } from "./quotes";
import { readStoredObject, imageToDataUrl } from "./uploads";
import { trackEvent } from "./app-events";
import { sendEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";

const SECTION_LABELS: Record<WordingSectionKey, string> = {
  title: "Quote title",
  jobSummary: "Job summary",
  scopeOfWork: "Scope of work",
  includedWork: "Included work",
  assumptions: "Assumptions",
  exclusions: "Exclusions",
  customerResponsibilities: "Customer responsibilities",
  paymentTerms: "Payment terms",
  estimatedSchedule: "Estimated schedule",
  warrantyWording: "Warranty wording",
  validityWording: "Quote validity",
  followUpEmail: "Follow-up email",
};

async function maybeWarnTrialLimit(workspaceId: string, userId: string | null) {
  const ent = await getWorkspaceEntitlements(workspaceId);
  if (ent.isTrial && ent.totalAvailable <= 1) {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: true } });
    if (!ws) return;
    const recent = await prisma.emailEvent.findFirst({ where: { workspaceId, kind: "TRIAL_LIMIT_WARNING", createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) } } });
    if (recent) return;
    await sendEmail({ kind: "TRIAL_LIMIT_WARNING", to: ws.owner.email, workspaceId, userId: ws.ownerId, variables: { name: ws.owner.name, remaining: ent.totalAvailable, billingUrl: `${getEnv().APP_URL}/app/billing` } });
    if (ent.totalAvailable === 0) await trackEvent({ name: "trial_limit_reached", userId, workspaceId });
  }
}

/** Transcribes an audio media item and stores the transcript on the quote. */
export async function transcribeQuoteAudio(workspaceId: string, quoteId: string, userId: string | null, mediaId: string) {
  if (!(await isFeatureEnabled("voice_recording"))) throw new AppError("Voice notes are currently disabled.");
  await enforceRateLimit("aiGeneration", workspaceId);
  const media = await prisma.quoteMedia.findFirst({ where: { id: mediaId, quoteId, workspaceId, kind: "AUDIO" }, include: { storedObject: true } });
  if (!media) throw new AppError("Audio file not found.");
  const file = await readStoredObject(media.storedObject.id);
  if (!file) throw new AppError("Audio file is missing from storage.");
  const result = await runTranscription({ workspaceId, userId, quoteId, buffer: file.body, filename: media.storedObject.originalFilename ?? "audio.webm", mimeType: file.mimeType });
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { transcript: true } });
  const combined = [quote.transcript, result.text].filter((t) => t && t.trim()).join("\n\n");
  await prisma.$transaction([
    prisma.quoteMedia.update({ where: { id: media.id }, data: { transcript: result.text } }),
    prisma.quote.update({ where: { id: quoteId }, data: { transcript: combined } }),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "AI_ANALYSIS", actorUserId: userId, message: result.provider === "mock" ? "Voice note transcribed (mock provider)" : "Voice note transcribed", metadata: { runId: result.runId } }),
  ]);
  return { transcript: result.text, provider: result.provider };
}

/**
 * Runs the enquiry analysis. A credit is consumed only after the AI run has
 * succeeded and been validated; the credit consumption is idempotent on the
 * run id so retries can never double-charge.
 */
export async function analyseQuoteEnquiry(workspaceId: string, quoteId: string, userId: string | null): Promise<{ analysis: EnquiryAnalysis; provider: string; creditsRemaining: number }> {
  await enforceRateLimit("aiGeneration", workspaceId);
  await assertCanGenerate(workspaceId);
  const quote = await getQuote(workspaceId, quoteId);
  const hasInput = !!(quote.enquiryText?.trim() || quote.jobNotes?.trim() || quote.transcript?.trim() || quote.media.length > 0);
  if (!hasInput) throw new AppError("Add a customer message, job notes, a voice note or photographs before running the analysis.");
  const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId } });
  const catalogue = await activeCatalogueForAi(workspaceId);
  const photoAnalysisEnabled = await isFeatureEnabled("photo_analysis");
  const images: Array<{ dataUrl: string }> = [];
  if (photoAnalysisEnabled) {
    for (const media of quote.media.filter((m) => m.kind === "IMAGE").slice(0, 8)) {
      const file = await readStoredObject(media.storedObject.id);
      if (file) images.push({ dataUrl: imageToDataUrl(file.body, file.mimeType) });
    }
  }
  const documents: string[] = [];
  for (const media of quote.media.filter((m) => m.kind === "DOCUMENT" && m.storedObject.mimeType === "text/plain").slice(0, 3)) {
    const file = await readStoredObject(media.storedObject.id);
    if (file) documents.push(file.body.toString("utf8").slice(0, 6000));
  }
  const idempotencyKey = `analysis:${quoteId}:${randomUUID()}`;
  const run = await runStructuredAi({
    feature: "ENQUIRY_ANALYSIS",
    workspaceId,
    userId,
    quoteId,
    schema: enquiryAnalysisSchema,
    schemaName: "enquiry_analysis",
    images,
    idempotencyKey,
    variables: {
      businessName: settings.businessName,
      trade: findTradeTemplate(settings.tradeSlug).name,
      currency: settings.currency,
      enquiryText: quote.enquiryText ?? "(none)",
      jobNotes: quote.jobNotes ?? "(none)",
      transcript: quote.transcript ?? "(none)",
      documents: documents.length > 0 ? documents.join("\n---\n") : "(none)",
      photoCount: images.length,
      catalogue: catalogue.length > 0 ? catalogue.map((c) => `${c.id} | ${c.name} | ${c.category} | ${c.unit}`).join("\n") : "(no catalogue items yet)",
    },
    fixtureHint: { catalogue, photoCount: images.length },
  });
  // Only allow catalogue ids that belong to this workspace.
  const validIds = new Set(catalogue.map((c) => c.id));
  const analysis: EnquiryAnalysis = {
    ...run.data,
    suggestedWork: run.data.suggestedWork.map((w) => (w.matchedCatalogueItemId && !validIds.has(w.matchedCatalogueItemId) ? { ...w, matchedCatalogueItemId: null, matchedCatalogueItemName: null, matchConfidence: null } : w)),
  };
  const consumption = await consumeGeneration({ workspaceId, userId, idempotencyKey: `credit:${run.runId}`, aiRunId: run.runId, reason: "Enquiry analysis" });
  try {
    await prisma.$transaction([
      prisma.aiRun.update({ where: { id: run.runId }, data: { creditConsumed: true } }),
      prisma.quote.update({ where: { id: quoteId }, data: { aiAnalysis: JSON.parse(JSON.stringify(analysis)), aiAnalysisAt: new Date(), wizardStep: Math.max(quote.wizardStep, 3) } }),
      addQuoteEvent(prisma, { workspaceId, quoteId, type: "AI_ANALYSIS", actorUserId: userId, message: run.provider === "mock" ? "AI analysis completed (mock provider)" : "AI analysis completed", metadata: { runId: run.runId, suggestions: analysis.suggestedWork.length, readiness: analysis.readiness.level } }),
    ]);
  } catch (error) {
    await refundGeneration({ workspaceId, idempotencyKey: `credit:${run.runId}`, reason: "Failed to store analysis" });
    throw error;
  }
  await trackEvent({ name: "ai_analysis_completed", userId, workspaceId, properties: { quoteId, suggestions: analysis.suggestedWork.length, images: images.length } });
  await maybeWarnTrialLimit(workspaceId, userId);
  return { analysis, provider: run.provider, creditsRemaining: consumption.remainingAllowance + consumption.creditBalance };
}

function itemsForPrompt(quote: Awaited<ReturnType<typeof getQuote>>): string {
  return (quote.currentVersion?.items ?? []).map((i) => `${i.description} | ${i.quantity.toString()} | ${i.unit} | ${i.kind}`).join("\n") || "(no line items yet)";
}

/** Generates all wording sections. Consumes one AI generation on success. */
export async function generateQuoteWording(workspaceId: string, quoteId: string, userId: string | null) {
  await enforceRateLimit("aiGeneration", workspaceId);
  await assertCanGenerate(workspaceId);
  const quote = await getQuote(workspaceId, quoteId);
  if (!quote.currentVersion || quote.currentVersion.isLocked) throw new AppError("This version is locked.");
  if (quote.currentVersion.items.length === 0) throw new AppError("Add line items before generating wording.");
  const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId } });
  const analysis = quote.aiAnalysis as EnquiryAnalysis | null;
  const template = quote.template;
  const v = quote.currentVersion;
  const totals = `Subtotal ${formatMoney(v.subtotalMinor, quote.currency)}; discount ${formatMoney(v.discountMinor, quote.currency)}; ${v.taxLabel} ${formatMoney(v.taxMinor, quote.currency)}; total ${formatMoney(v.totalMinor, quote.currency)}`;
  const variables = {
    businessName: settings.businessName,
    trade: findTradeTemplate(settings.tradeSlug).name,
    customerName: quote.customer?.contactName ?? "the customer",
    jobAddress: [quote.jobAddressLine1, quote.jobCity, quote.jobPostalCode].filter(Boolean).join(", ") || "(not provided)",
    jobSummary: analysis?.jobSummary ?? quote.enquiryText ?? quote.jobNotes ?? "(none)",
    lineItems: itemsForPrompt(quote),
    totals,
    paymentTermsDefault: v.paymentTerms ?? settings.paymentTerms,
    warrantyDefault: v.warrantyWording ?? settings.warrantyWording ?? "",
    validityDays: settings.quoteValidityDays,
    expiryDate: formatDate(quote.expiresAt),
    assumptionsInput: analysis?.assumptions.map((a) => `- ${a}`).join("\n") || v.assumptions || "",
    exclusionsInput: v.exclusions ?? template?.exclusions ?? "",
    customerQuestionsInput: analysis?.customerQuestions.map((q) => `- ${q}`).join("\n") || "",
    templateGuidance: [template?.scopeOfWork, template?.includedWork].filter(Boolean).join("\n") || "",
  };
  const run = await runStructuredAi({
    feature: "QUOTE_WORDING",
    workspaceId,
    userId,
    quoteId,
    schema: quoteWordingSchema,
    schemaName: "quote_wording",
    variables,
    fixtureHint: { ...variables, customerQuestions: analysis?.customerQuestions ?? [] },
  });
  const consumption = await consumeGeneration({ workspaceId, userId, idempotencyKey: `credit:${run.runId}`, aiRunId: run.runId, reason: "Quote wording" });
  try {
    const w = run.data;
    await prisma.$transaction([
      prisma.aiRun.update({ where: { id: run.runId }, data: { creditConsumed: true } }),
      prisma.quoteVersion.update({
        where: { id: v.id },
        data: {
          title: w.title,
          jobSummary: w.jobSummary,
          scopeOfWork: w.scopeOfWork,
          includedWork: w.includedWork,
          assumptions: w.assumptions,
          exclusions: w.exclusions,
          customerResponsibilities: w.customerResponsibilities,
          paymentTerms: w.paymentTerms || v.paymentTerms,
          estimatedSchedule: w.estimatedSchedule,
          warrantyWording: w.warrantyWording || v.warrantyWording,
          validityWording: w.validityWording || v.validityWording,
          followUpEmail: w.followUpEmail,
          customerQuestions: w.customerQuestions,
        },
      }),
      prisma.quote.update({ where: { id: quoteId }, data: { title: w.title, wizardStep: Math.max(quote.wizardStep, 5), pdfObjectId: null } }),
      addQuoteEvent(prisma, { workspaceId, quoteId, type: "AI_GENERATION", actorUserId: userId, message: run.provider === "mock" ? "Quote wording generated (mock provider)" : "Quote wording generated", metadata: { runId: run.runId } }),
    ]);
  } catch (error) {
    await refundGeneration({ workspaceId, idempotencyKey: `credit:${run.runId}`, reason: "Failed to store wording" });
    throw error;
  }
  await trackEvent({ name: "quote_generated", userId, workspaceId, properties: { quoteId } });
  await maybeWarnTrialLimit(workspaceId, userId);
  return { wording: run.data, provider: run.provider, creditsRemaining: consumption.remainingAllowance + consumption.creditBalance };
}

/** Regenerates one section without replacing the others. Does not consume a credit. */
export async function regenerateSection(workspaceId: string, quoteId: string, userId: string | null, section: WordingSectionKey, instruction: string) {
  if (!WORDING_SECTION_KEYS.includes(section)) throw new AppError("Unknown section");
  await enforceRateLimit("aiGeneration", workspaceId);
  const quote = await getQuote(workspaceId, quoteId);
  if (!quote.currentVersion || quote.currentVersion.isLocked) throw new AppError("This version is locked.");
  const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId } });
  const analysis = quote.aiAnalysis as EnquiryAnalysis | null;
  const current = (quote.currentVersion as unknown as Record<string, string | null>)[section] ?? "";
  const run = await runStructuredAi({
    feature: "SECTION_REGENERATE",
    workspaceId,
    userId,
    quoteId,
    schema: sectionRegenerateSchema,
    schemaName: "section_regenerate",
    variables: {
      businessName: settings.businessName,
      trade: findTradeTemplate(settings.tradeSlug).name,
      sectionName: SECTION_LABELS[section],
      currentContent: current ?? "",
      instruction: instruction.slice(0, 500),
      jobSummary: analysis?.jobSummary ?? quote.currentVersion.jobSummary ?? "",
      lineItems: itemsForPrompt(quote),
    },
    fixtureHint: { currentContent: current, sectionName: SECTION_LABELS[section] },
  });
  const content = section === "title" ? run.data.content.split("\n")[0]!.slice(0, 120) : run.data.content;
  await prisma.$transaction([
    prisma.quoteVersion.update({ where: { id: quote.currentVersion.id }, data: { [section]: content } }),
    ...(section === "title" ? [prisma.quote.update({ where: { id: quoteId }, data: { title: content, pdfObjectId: null } })] : [prisma.quote.update({ where: { id: quoteId }, data: { pdfObjectId: null } })]),
    addQuoteEvent(prisma, { workspaceId, quoteId, type: "AI_GENERATION", actorUserId: userId, message: `${SECTION_LABELS[section]} regenerated`, metadata: { runId: run.runId, section } }),
  ]);
  return { content, provider: run.provider };
}

export { AiRunError, SECTION_LABELS };
