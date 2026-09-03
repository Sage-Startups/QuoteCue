"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWritableWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertFeature } from "@/lib/billing/entitlements";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors, formDataToObject } from "@/lib/utils/zod-form";
import { findTradeTemplate } from "@/lib/data/trade-templates";

const templateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  defaultTitle: z.string().trim().max(120).optional().or(z.literal("")),
  scopeOfWork: z.string().trim().max(6000).optional().or(z.literal("")),
  includedWork: z.string().trim().max(4000).optional().or(z.literal("")),
  assumptions: z.string().trim().max(4000).optional().or(z.literal("")),
  exclusions: z.string().trim().max(4000).optional().or(z.literal("")),
  customerResponsibilities: z.string().trim().max(3000).optional().or(z.literal("")),
  paymentTerms: z.string().trim().max(2000).optional().or(z.literal("")),
  warrantyWording: z.string().trim().max(2000).optional().or(z.literal("")),
  estimatedSchedule: z.string().trim().max(1500).optional().or(z.literal("")),
  customerQuestions: z.string().trim().max(3000).optional().or(z.literal("")),
  isDefault: z.coerce.boolean().default(false),
});

const nul = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function saveTemplateAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const raw = formDataToObject(formData);
    raw.isDefault = formData.get("isDefault") === "on";
    const parsed = templateSchema.safeParse(raw);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const id = String(formData.get("id") ?? "");
    const count = await prisma.quoteTemplate.count({ where: { workspaceId: ctx.workspace.id, archivedAt: null } });
    if (!id && count >= 1) await assertFeature(ctx.workspace.id, "CUSTOM_TEMPLATES");
    const d = parsed.data;
    const data = {
      name: d.name,
      description: nul(d.description),
      defaultTitle: nul(d.defaultTitle),
      scopeOfWork: nul(d.scopeOfWork),
      includedWork: nul(d.includedWork),
      assumptions: nul(d.assumptions),
      exclusions: nul(d.exclusions),
      customerResponsibilities: nul(d.customerResponsibilities),
      paymentTerms: nul(d.paymentTerms),
      warrantyWording: nul(d.warrantyWording),
      estimatedSchedule: nul(d.estimatedSchedule),
      customerQuestions: (d.customerQuestions ?? "").split("\n").map((q) => q.replace(/^[-*]\s*/, "").trim()).filter(Boolean),
    };
    const saved = await prisma.$transaction(async (tx) => {
      if (d.isDefault) await tx.quoteTemplate.updateMany({ where: { workspaceId: ctx.workspace.id, isDefault: true, id: id ? { not: id } : undefined }, data: { isDefault: false } });
      if (id) {
        const existing = await tx.quoteTemplate.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
        if (!existing) throw new Error("Template not found");
        return tx.quoteTemplate.update({ where: { id }, data: { ...data, isDefault: d.isDefault || (existing.isDefault && count === 1) }, select: { id: true } });
      }
      return tx.quoteTemplate.create({ data: { ...data, workspaceId: ctx.workspace.id, isDefault: d.isDefault || count === 0 }, select: { id: true } });
    });
    revalidatePath("/app/templates");
    return ok({ id: saved.id }, "Template saved");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function archiveTemplateAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    const template = await prisma.quoteTemplate.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
    if (!template) return fail("Template not found");
    if (template.isDefault) return fail("Set another template as default before archiving this one.");
    await prisma.quoteTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
    revalidatePath("/app/templates");
    return ok(undefined, "Template archived");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function createTemplateFromTradeAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const count = await prisma.quoteTemplate.count({ where: { workspaceId: ctx.workspace.id, archivedAt: null } });
    if (count >= 1) await assertFeature(ctx.workspace.id, "CUSTOM_TEMPLATES");
    const trade = findTradeTemplate(String(formData.get("tradeSlug")));
    await prisma.quoteTemplate.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: `${trade.name} template`,
        tradeSlug: trade.slug,
        description: trade.description,
        scopeOfWork: trade.defaultScope,
        exclusions: trade.commonExclusions.map((e) => `- ${e}`).join("\n"),
        assumptions: trade.defaultAssumptions.map((a) => `- ${a}`).join("\n"),
        customerQuestions: trade.commonQuestions,
        paymentTerms: trade.defaultTerms,
        isDefault: count === 0,
      },
    });
    revalidatePath("/app/templates");
    return ok(undefined, "Template created from trade defaults");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
