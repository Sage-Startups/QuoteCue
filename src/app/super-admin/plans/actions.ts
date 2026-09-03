"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ENTITLEMENT_KEYS, type EntitlementKey } from "@/lib/billing/plans";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { decimalToMinor } from "@/components/admin/format";
import { adminAction, adminAudit, linesToArray } from "../_lib/admin";

const priceIdSchema = z
  .string()
  .trim()
  .regex(/^price_[A-Za-z0-9]+$/, "Must look like price_XXXX")
  .or(z.literal(""));

const decimalSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount such as 19.00")
  .or(z.literal(""));

const planSchema = z.object({
  planId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(400),
  monthlyPrice: decimalSchema,
  annualPrice: decimalSchema,
  oneTimePrice: decimalSchema,
  aiGenerationsPerPeriod: z.coerce.number().int().min(0).max(100000),
  creditsGranted: z.coerce.number().int().min(0).max(100000),
  maxMembers: z.coerce.number().int().min(0).max(1000),
  storageAllowanceMb: z.coerce.number().int().min(0).max(1_000_000),
  featureBullets: z.string().max(4000),
  stripeMonthlyPriceId: priceIdSchema,
  stripeAnnualPriceId: priceIdSchema,
  stripeOneTimePriceId: priceIdSchema,
  isActive: z.boolean(),
  isPublic: z.boolean(),
  highlight: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  entitlements: z.array(z.enum(Object.keys(ENTITLEMENT_KEYS) as [EntitlementKey, ...EntitlementKey[]])),
});

async function verifyStripePrice(id: string, field: string): Promise<Record<string, string[]> | null> {
  if (!id || !isStripeConfigured()) return null;
  try {
    await getStripe()!.prices.retrieve(id);
    return null;
  } catch (error) {
    return { [field]: [`Stripe could not find this price: ${(error as Error).message}`] };
  }
}

export async function savePlanAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = planSchema.safeParse({
      planId: formData.get("planId"),
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      monthlyPrice: formData.get("monthlyPrice") ?? "",
      annualPrice: formData.get("annualPrice") ?? "",
      oneTimePrice: formData.get("oneTimePrice") ?? "",
      aiGenerationsPerPeriod: formData.get("aiGenerationsPerPeriod") ?? 0,
      creditsGranted: formData.get("creditsGranted") ?? 0,
      maxMembers: formData.get("maxMembers") ?? 0,
      storageAllowanceMb: formData.get("storageAllowanceMb") ?? 0,
      featureBullets: formData.get("featureBullets") ?? "",
      stripeMonthlyPriceId: formData.get("stripeMonthlyPriceId") ?? "",
      stripeAnnualPriceId: formData.get("stripeAnnualPriceId") ?? "",
      stripeOneTimePriceId: formData.get("stripeOneTimePriceId") ?? "",
      isActive: formData.get("isActive") === "on",
      isPublic: formData.get("isPublic") === "on",
      highlight: formData.get("highlight") === "on",
      sortOrder: formData.get("sortOrder") ?? 0,
      entitlements: formData.getAll("entitlements").map(String),
    });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const input = parsed.data;
    const plan = await prisma.plan.findUnique({ where: { id: input.planId }, include: { entitlements: true } });
    if (!plan) return fail("Plan not found.");

    for (const [field, value] of [["stripeMonthlyPriceId", input.stripeMonthlyPriceId], ["stripeAnnualPriceId", input.stripeAnnualPriceId], ["stripeOneTimePriceId", input.stripeOneTimePriceId]] as const) {
      const problem = await verifyStripePrice(value, field);
      if (problem) return fail("A Stripe price id could not be verified.", problem);
    }

    const data = {
      name: input.name,
      description: input.description || null,
      monthlyPriceMinor: decimalToMinor(input.monthlyPrice || "0"),
      annualPriceMinor: decimalToMinor(input.annualPrice || "0"),
      oneTimePriceMinor: decimalToMinor(input.oneTimePrice || "0"),
      aiGenerationsPerPeriod: input.aiGenerationsPerPeriod,
      creditsGranted: input.creditsGranted,
      maxMembers: input.maxMembers,
      storageAllowanceMb: input.storageAllowanceMb,
      featureBullets: linesToArray(input.featureBullets),
      stripeMonthlyPriceId: input.stripeMonthlyPriceId || null,
      stripeAnnualPriceId: input.stripeAnnualPriceId || null,
      stripeOneTimePriceId: input.stripeOneTimePriceId || null,
      isActive: input.isActive,
      isPublic: input.isPublic,
      highlight: input.highlight,
      sortOrder: input.sortOrder,
    };
    const previous = {
      name: plan.name,
      description: plan.description,
      monthlyPriceMinor: plan.monthlyPriceMinor,
      annualPriceMinor: plan.annualPriceMinor,
      oneTimePriceMinor: plan.oneTimePriceMinor,
      aiGenerationsPerPeriod: plan.aiGenerationsPerPeriod,
      creditsGranted: plan.creditsGranted,
      maxMembers: plan.maxMembers,
      storageAllowanceMb: plan.storageAllowanceMb,
      featureBullets: plan.featureBullets,
      stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
      stripeAnnualPriceId: plan.stripeAnnualPriceId,
      stripeOneTimePriceId: plan.stripeOneTimePriceId,
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      highlight: plan.highlight,
      sortOrder: plan.sortOrder,
      entitlements: plan.entitlements.filter((e) => e.enabled).map((e) => e.key).sort(),
    };
    const wanted = new Set(input.entitlements);
    await prisma.$transaction([
      prisma.plan.update({ where: { id: plan.id }, data }),
      prisma.planEntitlement.deleteMany({ where: { planId: plan.id, key: { notIn: [...wanted] } } }),
      ...[...wanted].map((key) => prisma.planEntitlement.upsert({ where: { planId_key: { planId: plan.id, key } }, create: { planId: plan.id, key, enabled: true }, update: { enabled: true } })),
    ]);
    await adminAudit(admin, { action: "plan.update", targetType: "plan", targetId: plan.id, previousValue: previous, newValue: { ...data, entitlements: [...wanted].sort() } });
    revalidatePath("/super-admin/plans");
    revalidatePath("/pricing");
    revalidatePath("/app/billing");
    return ok(undefined, `${input.name} saved.`);
  });
}
