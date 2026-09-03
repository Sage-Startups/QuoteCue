"use server";

import { revalidatePath } from "next/cache";
import { getEnv } from "@/lib/env";
import { seedDemoWorkspace } from "@/lib/seed/demo";
import { seedPlatform } from "@/lib/seed/platform";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/utils/request";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { buildMockFixture } from "@/lib/ai/mock-fixtures";
import { enquiryAnalysisSchema, quoteWordingSchema, type EnquiryAnalysis, type QuoteWording } from "@/lib/ai/schemas";
import { getDemoWorkspace } from "@/lib/services/demo";
import { prisma } from "@/lib/db";

/** Rebuilds the demo workspace. Rate limited because it is public. */
export async function resetDemoAction(): Promise<ActionResult> {
  if (!getEnv().DEMO_MODE) return fail("Demo mode is disabled.");
  const ip = await getClientIp();
  const limit = await checkRateLimit("demoReset", ip ?? "unknown", { limit: 3, windowSeconds: 600 });
  if (!limit.allowed) return fail("The demo was reset recently. Please try again in a few minutes.");
  await seedPlatform();
  await seedDemoWorkspace();
  revalidatePath("/demo", "layout");
  return ok(undefined, "Demo reset");
}

/** Runs the mock analysis for the interactive demo. Never calls a paid provider or touches the database. */
export async function demoAnalyseAction(enquiry: string): Promise<ActionResult<{ analysis: EnquiryAnalysis; catalogue: Array<{ id: string; name: string; unit: string; kind: string; unitPriceMinor: number; internalCostMinor: number }> }>> {
  const demo = await getDemoWorkspace();
  if (!demo) return fail("Demo mode is disabled.");
  const catalogue = await prisma.serviceCatalogueItem.findMany({ where: { workspaceId: demo.id, archivedAt: null }, select: { id: true, name: true, unit: true, kind: true, unitPriceMinor: true, internalCostMinor: true, category: true } });
  const fixture = buildMockFixture("enquiry_analysis", enquiry.slice(0, 4000), { catalogue, photoCount: 0 });
  const parsed = enquiryAnalysisSchema.safeParse(fixture);
  if (!parsed.success) return fail("The demo analysis could not be produced.");
  return ok({ analysis: parsed.data, catalogue });
}

export async function demoWordingAction(input: { lineItems: string; jobSummary: string; customerName: string }): Promise<ActionResult<QuoteWording>> {
  const demo = await getDemoWorkspace();
  if (!demo) return fail("Demo mode is disabled.");
  const fixture = buildMockFixture("quote_wording", input.lineItems.toLowerCase(), { businessName: demo.name, customerName: input.customerName, jobSummary: input.jobSummary, lineItems: input.lineItems, paymentTermsDefault: demo.settings?.paymentTerms, warrantyDefault: demo.settings?.warrantyWording, validityDays: demo.settings?.quoteValidityDays ?? 30 });
  const parsed = quoteWordingSchema.safeParse(fixture);
  if (!parsed.success) return fail("The demo wording could not be produced.");
  return ok(parsed.data);
}
