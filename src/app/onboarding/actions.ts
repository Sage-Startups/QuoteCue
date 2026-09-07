"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, WORKSPACE_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createWorkspaceFromOnboarding, onboardingSchema } from "@/lib/services/workspace";
import { createQuote, saveLineItems } from "@/lib/services/quotes";
import { createCustomer } from "@/lib/services/customers";
import { addMonths } from "@/lib/utils/dates";
import { fail, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { findTradeTemplate } from "@/lib/data/trade-templates";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { PENDING_PLAN_COOKIE } from "@/lib/billing/pending-plan";

/**
 * Turns a plan chosen at sign-up into the next destination. Onboarding can be
 * submitted more than once (a double click, a reload), and the second run
 * returns early because the workspace already exists, so both paths resolve the
 * pending plan or the choice is silently dropped.
 */
async function redirectForPendingPlan(input: { workspaceId: string; userId: string; email: string; workspaceName: string; fallback: string }): Promise<string> {
  const cookieStore = await cookies();
  const pending = cookieStore.get(PENDING_PLAN_COOKIE)?.value;
  if (!pending) return input.fallback;
  cookieStore.delete(PENDING_PLAN_COOKIE);
  const [planKey, rawInterval] = pending.split(":");
  if (planKey !== "STARTER" && planKey !== "PRO") return input.fallback;
  try {
    const checkout = await createCheckoutSession({
      workspaceId: input.workspaceId,
      userId: input.userId,
      email: input.email,
      workspaceName: input.workspaceName,
      planKey,
      interval: rawInterval === "annual" ? "YEAR" : "MONTH",
    });
    return checkout.url;
  } catch (error) {
    // Never strand someone in onboarding because billing is unavailable: the
    // workspace exists and the free trial is already active.
    console.error("[onboarding] could not start checkout for the chosen plan", error);
    return "/app/billing?checkout=unavailable";
  }
}

export async function completeOnboardingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.includeCatalogue = formData.get("includeCatalogue") === "on";
  raw.createSampleQuote = formData.get("createSampleQuote") === "on";
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  let destination = "/app";
  const existing = await prisma.workspaceMember.findFirst({ where: { userId: session.user.id } });
  if (existing) {
    const workspace = await prisma.workspace.findUnique({ where: { id: existing.workspaceId }, select: { name: true } });
    redirect(await redirectForPendingPlan({ workspaceId: existing.workspaceId, userId: session.user.id, email: session.user.email, workspaceName: workspace?.name ?? "Workspace", fallback: "/app" }));
  }
  try {
    const { workspaceId } = await createWorkspaceFromOnboarding(session.user.id, parsed.data);
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", expires: addMonths(new Date(), 12) });
    let redirectTo = "/app?welcome=1";
    if (parsed.data.createSampleQuote) {
      const trade = findTradeTemplate(parsed.data.tradeSlug);
      const customer = await createCustomer(workspaceId, {
        type: "INDIVIDUAL",
        contactName: "Sample Customer",
        companyName: "",
        email: "",
        phone: "",
        preferredContactMethod: "EMAIL",
        billingAddressLine1: "1 Example Street",
        billingAddressLine2: "",
        billingCity: "",
        billingRegion: "",
        billingPostalCode: "",
        billingCountry: parsed.data.country,
        jobAddressSameAsBilling: true,
        jobAddressLine1: "",
        jobAddressLine2: "",
        jobCity: "",
        jobRegion: "",
        jobPostalCode: "",
        jobCountry: "",
        internalNotes: "Created automatically as a sample. Safe to delete.",
        tags: ["Sample"],
      });
      const quote = await createQuote({ workspaceId, userId: session.user.id, basics: { customerId: customer.id, title: `Sample quote — ${trade.name.toLowerCase()} work` } });
      const items = await prisma.serviceCatalogueItem.findMany({ where: { workspaceId, archivedAt: null }, orderBy: { sortOrder: "asc" }, take: 3 });
      const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId } });
      await saveLineItems(
        workspaceId,
        quote.id,
        session.user.id,
        items.map((i, idx) => ({
          description: i.name,
          customerDescription: i.customerDescription ?? "",
          quantity: idx === 0 ? "2" : "1",
          unit: i.unit,
          kind: i.kind,
          unitPriceMinor: i.unitPriceMinor,
          discountType: "NONE" as const,
          discountValue: 0,
          taxTreatment: i.taxTreatment,
          internalCostMinor: i.internalCostMinor,
          catalogueItemId: i.id,
          isOptional: false,
          aiSuggested: false,
        })),
        {
          pricingMode: settings.pricingMode,
          taxRateBps: settings.taxRateBps,
          taxLabel: settings.taxLabel,
          discountType: "NONE",
          discountValue: 0,
          callOutFeeMinor: settings.callOutFeeMinor,
          callOutFeeLabel: "Call-out fee",
          depositTerms: settings.depositTerms ?? "",
          internalNotes: "Sample quote created during onboarding.",
        },
      );
      await prisma.quote.update({ where: { id: quote.id }, data: { enquiryText: "This is a sample enquiry so you can explore the quote wizard. Replace it with a real customer message or delete the quote.", wizardStep: 4 } });
      redirectTo = `/app/quotes/${quote.id}/edit?step=4&welcome=1`;
    }
    redirectTo = await redirectForPendingPlan({
      workspaceId,
      userId: session.user.id,
      email: session.user.email,
      workspaceName: parsed.data.businessName,
      fallback: redirectTo,
    });
    destination = redirectTo;
  } catch (error) {
    console.error("[onboarding] failed", error);
    return fail(toUserMessage(error, "We could not create your workspace. Please try again."));
  }
  // Outside the try: redirect() signals by throwing and must not be caught.
  redirect(destination);
}

export async function skipToDashboardAction(): Promise<void> {
  redirect("/app");
}
