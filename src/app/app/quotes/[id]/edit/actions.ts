"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWritableWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quoteBasicsSchema, updateQuoteBasics, enquirySchema, updateEnquiry, removeQuoteMedia, saveLineItems, lineItemSchema, pricingSettingsSchema, saveWording, wordingSchema, setWizardStep, getQuote } from "@/lib/services/quotes";
import { transcribeQuoteAudio, analyseQuoteEnquiry, generateQuoteWording, regenerateSection } from "@/lib/services/quote-ai";
import { deleteStoredObject } from "@/lib/services/uploads";
import { WORDING_SECTION_KEYS, type WordingSectionKey, type EnquiryAnalysis } from "@/lib/ai/schemas";
import { calculateQuote } from "@/lib/quotes/pricing";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import type { WizardLineItem, WizardPricing, WizardWording } from "@/components/wizard/types";

function revalidate(id: string) {
  revalidatePath(`/app/quotes/${id}/edit`);
  revalidatePath(`/app/quotes/${id}`);
  revalidatePath("/app/quotes");
}

export async function saveBasicsAction(quoteId: string, input: Record<string, string>): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const parsed = quoteBasicsSchema.safeParse(input);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await updateQuoteBasics(ctx.workspace.id, quoteId, ctx.user.id, parsed.data);
    revalidate(quoteId);
    return ok(undefined, "Saved");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function saveEnquiryAction(quoteId: string, input: { enquiryText: string; jobNotes: string; transcript?: string }): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const parsed = enquirySchema.safeParse(input);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await updateEnquiry(ctx.workspace.id, quoteId, ctx.user.id, parsed.data);
    revalidate(quoteId);
    return ok(undefined, "Saved");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function removeMediaAction(quoteId: string, mediaId: string): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const media = await removeQuoteMedia(ctx.workspace.id, quoteId, mediaId);
    await deleteStoredObject(media.storedObjectId, ctx.workspace.id);
    revalidate(quoteId);
    return ok(undefined, "File removed");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function transcribeAction(quoteId: string, mediaId: string): Promise<ActionResult<{ transcript: string; provider: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const result = await transcribeQuoteAudio(ctx.workspace.id, quoteId, ctx.user.id, mediaId);
    revalidate(quoteId);
    return ok(result, result.provider === "mock" ? "Transcribed with the mock provider (no API key configured)" : "Voice note transcribed");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function analyseAction(quoteId: string): Promise<ActionResult<{ analysis: EnquiryAnalysis; creditsRemaining: number; provider: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const result = await analyseQuoteEnquiry(ctx.workspace.id, quoteId, ctx.user.id);
    revalidate(quoteId);
    return ok(result, result.provider === "mock" ? "Analysis complete (mock AI provider)" : "Analysis complete");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const applySchema = z.array(z.object({ index: z.number().int().min(0), quantity: z.union([z.string(), z.number()]).optional(), catalogueItemId: z.string().uuid().nullable().optional() })).max(60);

/** Turns selected AI suggestions into line items priced from the catalogue. Unmatched items are added unpriced. */
export async function applySuggestionsAction(quoteId: string, selected: z.infer<typeof applySchema>): Promise<ActionResult<{ unpriced: number }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const parsed = applySchema.safeParse(selected);
    if (!parsed.success) return fail("Invalid selection.");
    const quote = await getQuote(ctx.workspace.id, quoteId);
    const analysis = quote.aiAnalysis as EnquiryAnalysis | null;
    if (!analysis) return fail("Run the analysis first.");
    const ids = parsed.data.map((s) => s.catalogueItemId ?? analysis.suggestedWork[s.index]?.matchedCatalogueItemId).filter((x): x is string => !!x);
    const catalogue = ids.length > 0 ? await prisma.serviceCatalogueItem.findMany({ where: { id: { in: ids }, workspaceId: ctx.workspace.id } }) : [];
    const byId = new Map(catalogue.map((c) => [c.id, c]));
    const existing = quote.currentVersion?.items ?? [];
    const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId: ctx.workspace.id } });
    let unpriced = 0;
    const newItems = parsed.data
      .map((s) => {
        const w = analysis.suggestedWork[s.index];
        if (!w) return null;
        const cat = byId.get(s.catalogueItemId ?? w.matchedCatalogueItemId ?? "");
        if (!cat) unpriced++;
        const qty = s.quantity !== undefined && s.quantity !== "" ? String(s.quantity) : w.quantity !== null ? String(w.quantity) : "1";
        return {
          description: cat?.name ?? w.description,
          customerDescription: cat?.customerDescription ?? (w.detail ?? ""),
          quantity: qty,
          unit: cat?.unit ?? w.unit ?? "ITEM",
          kind: cat?.kind ?? w.kind,
          unitPriceMinor: cat?.unitPriceMinor ?? 0,
          discountType: "NONE" as const,
          discountValue: 0,
          taxTreatment: cat?.taxTreatment ?? ("TAXABLE" as const),
          internalCostMinor: cat?.internalCostMinor ?? 0,
          catalogueItemId: cat?.id ?? null,
          isOptional: false,
          aiSuggested: true,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const merged = [
      ...existing.map((i) => ({
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
      ...newItems,
    ];
    const items = merged.map((m) => lineItemSchema.parse(m));
    const v = quote.currentVersion!;
    await saveLineItems(ctx.workspace.id, quoteId, ctx.user.id, items, {
      pricingMode: v.pricingMode,
      taxRateBps: v.taxRateBps,
      taxLabel: v.taxLabel,
      discountType: v.discountType,
      discountValue: v.discountValue,
      callOutFeeMinor: existing.length === 0 && v.callOutFeeMinor === 0 ? settings.callOutFeeMinor : v.callOutFeeMinor,
      callOutFeeLabel: v.callOutFeeLabel,
      depositTerms: v.depositTerms ?? "",
      internalNotes: quote.internalNotes ?? "",
    });
    await setWizardStep(ctx.workspace.id, quoteId, 4);
    revalidate(quoteId);
    return ok({ unpriced }, unpriced > 0 ? `${newItems.length} items added; ${unpriced} need a price` : `${newItems.length} items added`);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function savePricingAction(quoteId: string, items: WizardLineItem[], pricing: WizardPricing): Promise<ActionResult<{ totalMinor: number }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const parsedItems = z.array(lineItemSchema).max(100).safeParse(items.map(({ clientId: _c, unpriced: _u, id, ...rest }) => ({ ...rest, id: id && /^[0-9a-f-]{36}$/.test(id) ? id : undefined })));
    if (!parsedItems.success) return fail("Please check the line items.", zodFieldErrors(parsedItems.error));
    const parsedPricing = pricingSettingsSchema.safeParse(pricing);
    if (!parsedPricing.success) return fail("Please check the pricing settings.", zodFieldErrors(parsedPricing.error));
    const result = await saveLineItems(ctx.workspace.id, quoteId, ctx.user.id, parsedItems.data, parsedPricing.data);
    revalidate(quoteId);
    return ok({ totalMinor: result.totalMinor }, "Pricing saved");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

/** Server-side totals preview (deterministic), used to double-check client arithmetic. */
export async function previewTotalsAction(items: WizardLineItem[], pricing: WizardPricing) {
  const parsedItems = z.array(lineItemSchema).safeParse(items.map(({ clientId: _c, unpriced: _u, id: _i, ...rest }) => rest));
  const parsedPricing = pricingSettingsSchema.safeParse(pricing);
  if (!parsedItems.success || !parsedPricing.success) return null;
  return calculateQuote({
    lines: parsedItems.data.map((i) => ({ quantity: i.quantity, unitPriceMinor: i.unitPriceMinor, discountType: i.discountType, discountValue: i.discountValue, taxTreatment: i.taxTreatment, internalCostMinor: i.internalCostMinor, isOptional: i.isOptional })),
    pricingMode: parsedPricing.data.pricingMode,
    taxRateBps: parsedPricing.data.pricingMode === "NO_TAX" ? 0 : parsedPricing.data.taxRateBps,
    discountType: parsedPricing.data.discountType,
    discountValue: parsedPricing.data.discountValue,
    callOutFeeMinor: parsedPricing.data.callOutFeeMinor,
  });
}

export async function generateWordingAction(quoteId: string): Promise<ActionResult<{ wording: WizardWording; creditsRemaining: number; provider: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const result = await generateQuoteWording(ctx.workspace.id, quoteId, ctx.user.id);
    revalidate(quoteId);
    const w = result.wording;
    return ok({ wording: { ...w, customerNotes: "" }, creditsRemaining: result.creditsRemaining, provider: result.provider }, result.provider === "mock" ? "Wording generated (mock AI provider)" : "Wording generated");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function regenerateSectionAction(quoteId: string, section: string, instruction: string): Promise<ActionResult<{ content: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    if (!WORDING_SECTION_KEYS.includes(section as WordingSectionKey)) return fail("Unknown section");
    const result = await regenerateSection(ctx.workspace.id, quoteId, ctx.user.id, section as WordingSectionKey, instruction);
    revalidate(quoteId);
    return ok({ content: result.content }, "Section regenerated");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function saveWordingAction(quoteId: string, wording: WizardWording): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const parsed = wordingSchema.safeParse(wording);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await saveWording(ctx.workspace.id, quoteId, ctx.user.id, parsed.data);
    revalidate(quoteId);
    return ok(undefined, "Wording saved");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function setStepAction(quoteId: string, step: number): Promise<void> {
  const ctx = await requireWritableWorkspace();
  await setWizardStep(ctx.workspace.id, quoteId, step);
}
