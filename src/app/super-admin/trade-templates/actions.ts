"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { decimalToMinor } from "@/components/admin/format";
import { adminAction, adminAudit, linesToArray } from "../_lib/admin";
import { slugSchema, tradeTemplateSchema } from "./schema";

function parseServices(raw: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(raw ?? "[]"));
  } catch {
    return null;
  }
}

function templateFromForm(formData: FormData) {
  const services = parseServices(formData.get("suggestedServices"));
  if (services === null) return { success: false as const, error: "The services table could not be read." };
  const parsed = tradeTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    icon: formData.get("icon") ?? "",
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") ?? 0,
    defaultScope: formData.get("defaultScope") ?? "",
    defaultTerms: formData.get("defaultTerms") ?? "",
    commonExclusions: formData.get("commonExclusions") ?? "",
    commonQuestions: formData.get("commonQuestions") ?? "",
    defaultAssumptions: formData.get("defaultAssumptions") ?? "",
    suggestedServices: services,
  });
  if (!parsed.success) return { success: false as const, error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  return {
    success: true as const,
    data: {
      name: d.name,
      description: d.description || null,
      icon: d.icon || null,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
      defaultScope: d.defaultScope || null,
      defaultTerms: d.defaultTerms || null,
      commonExclusions: linesToArray(d.commonExclusions),
      commonQuestions: linesToArray(d.commonQuestions),
      defaultAssumptions: linesToArray(d.defaultAssumptions),
      suggestedServices: d.suggestedServices.map((s) => ({
        name: s.name,
        category: s.category || "General",
        unit: s.unit,
        kind: s.kind,
        unitPriceMinor: decimalToMinor(s.unitPrice || "0"),
        internalCostMinor: decimalToMinor(s.internalCost || "0"),
        ...(s.customerDescription ? { customerDescription: s.customerDescription } : {}),
      })),
    },
  };
}

export async function createTradeTemplateAction(_prev: ActionResult<{ slug: string }> | null, formData: FormData): Promise<ActionResult<{ slug: string }>> {
  return adminAction<{ slug: string }>(async (admin) => {
    const slug = slugSchema.safeParse(formData.get("slug"));
    if (!slug.success) return fail("Please check the highlighted fields.", zodFieldErrors(slug.error));
    const form = templateFromForm(formData);
    if (!form.success) return fail(form.error, form.fieldErrors);
    const existing = await prisma.tradeTemplate.findUnique({ where: { slug: slug.data }, select: { id: true } });
    if (existing) return fail("A template with that slug already exists.", { slug: ["Slug already in use"] });
    const created = await prisma.tradeTemplate.create({ data: { slug: slug.data, ...form.data } });
    await adminAudit(admin, { action: "trade_template.create", targetType: "trade_template", targetId: created.id, newValue: { slug: slug.data, ...form.data } });
    revalidatePath("/super-admin/trade-templates");
    revalidatePath("/templates");
    return ok({ slug: slug.data }, `${form.data.name} created.`);
  });
}

export async function updateTradeTemplateAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const slug = slugSchema.safeParse(formData.get("slug"));
    if (!slug.success) return fail("Unknown template.");
    const form = templateFromForm(formData);
    if (!form.success) return fail(form.error, form.fieldErrors);
    const existing = await prisma.tradeTemplate.findUnique({ where: { slug: slug.data } });
    if (!existing) return fail("Template not found.");
    await prisma.tradeTemplate.update({ where: { id: existing.id }, data: form.data });
    const previous = { name: existing.name, description: existing.description, icon: existing.icon, isActive: existing.isActive, sortOrder: existing.sortOrder, defaultScope: existing.defaultScope, defaultTerms: existing.defaultTerms, commonExclusions: existing.commonExclusions, commonQuestions: existing.commonQuestions, defaultAssumptions: existing.defaultAssumptions, suggestedServices: existing.suggestedServices };
    await adminAudit(admin, { action: "trade_template.update", targetType: "trade_template", targetId: existing.id, previousValue: previous, newValue: form.data });
    revalidatePath("/super-admin/trade-templates");
    revalidatePath(`/super-admin/trade-templates/${slug.data}`);
    revalidatePath("/templates");
    return ok(undefined, `${form.data.name} saved.`);
  });
}
