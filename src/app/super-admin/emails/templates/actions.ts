"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSiteSettings } from "@/lib/config/site-settings";
import { sendEmail } from "@/lib/email";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_KINDS } from "@/lib/email/templates";
import { findUnsupportedVariables, renderEmailHtml, substituteVariables } from "@/lib/email/render";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { adminAction, adminAudit } from "../../_lib/admin";
import { sampleVariables } from "./samples";
import type { EmailKind } from "@/generated/prisma/enums";

const kindSchema = z.enum(EMAIL_KINDS as [EmailKind, ...EmailKind[]]);

const templateSchema = z.object({
  kind: kindSchema,
  name: z.string().trim().min(1, "Name is required").max(80),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  previewText: z.string().trim().max(200),
  bodyMarkdown: z.string().min(1, "Body is required").max(20000),
  enabled: z.boolean(),
});

function allowedVariables(kind: EmailKind, stored?: unknown): string[] {
  const vars = Array.isArray(stored) ? (stored as string[]) : DEFAULT_EMAIL_TEMPLATES[kind].variables;
  return [...new Set([...vars, "productName", "supportEmail", "appUrl"])];
}

function checkVariables(kind: EmailKind, stored: unknown, fields: { subject: string; previewText: string; bodyMarkdown: string }): Record<string, string[]> | null {
  const allowed = allowedVariables(kind, stored);
  const errors: Record<string, string[]> = {};
  for (const [field, text] of Object.entries(fields)) {
    const unsupported = findUnsupportedVariables(text, allowed);
    if (unsupported.length > 0) errors[field] = [`Unsupported variable${unsupported.length === 1 ? "" : "s"}: ${unsupported.map((v) => `{{${v}}}`).join(", ")}`];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

function parseTemplateForm(formData: FormData) {
  return templateSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    previewText: formData.get("previewText") ?? "",
    bodyMarkdown: formData.get("bodyMarkdown"),
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
  });
}

export async function saveEmailTemplateAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = parseTemplateForm(formData);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const input = parsed.data;
    const existing = await prisma.emailTemplate.findUnique({ where: { kind: input.kind } });
    const varErrors = checkVariables(input.kind, existing?.variables, input);
    if (varErrors) return fail("The template uses variables that are not available for this email.", varErrors);
    const variables = allowedVariables(input.kind, existing?.variables).filter((v) => !["productName", "supportEmail", "appUrl"].includes(v));
    const data = { name: input.name, subject: input.subject, previewText: input.previewText || null, bodyMarkdown: input.bodyMarkdown, enabled: input.enabled };
    await prisma.emailTemplate.upsert({ where: { kind: input.kind }, create: { kind: input.kind, ...data, variables, updatedById: admin.user.id }, update: { ...data, updatedById: admin.user.id } });
    const previous = existing ? { name: existing.name, subject: existing.subject, previewText: existing.previewText, bodyMarkdown: existing.bodyMarkdown, enabled: existing.enabled } : { source: "default", ...DEFAULT_EMAIL_TEMPLATES[input.kind] };
    await adminAudit(admin, { action: "email_template.update", targetType: "email_template", targetId: input.kind, previousValue: previous, newValue: data });
    revalidatePath("/super-admin/emails/templates");
    revalidatePath(`/super-admin/emails/templates/${input.kind}`);
    return ok(undefined, "Template saved.");
  });
}

export async function resetEmailTemplateAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const kind = kindSchema.safeParse(formData.get("kind"));
    if (!kind.success) return fail("Unknown template.");
    const existing = await prisma.emailTemplate.findUnique({ where: { kind: kind.data } });
    if (!existing) return fail("This template already uses the built-in default.");
    await prisma.emailTemplate.delete({ where: { kind: kind.data } });
    await adminAudit(admin, { action: "email_template.reset", targetType: "email_template", targetId: kind.data, previousValue: { name: existing.name, subject: existing.subject, previewText: existing.previewText, bodyMarkdown: existing.bodyMarkdown, enabled: existing.enabled }, newValue: { source: "default" } });
    revalidatePath("/super-admin/emails/templates");
    revalidatePath(`/super-admin/emails/templates/${kind.data}`);
    return ok(undefined, "Template reset to the built-in default.");
  });
}

export interface EmailPreviewResult {
  subject: string;
  html: string;
}

/** Renders the given template fields with sample values and current branding. Nothing is stored. */
export async function previewEmailTemplateAction(_prev: ActionResult<EmailPreviewResult> | null, formData: FormData): Promise<ActionResult<EmailPreviewResult>> {
  return adminAction<EmailPreviewResult>(async () => {
    const parsed = parseTemplateForm(formData);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const input = parsed.data;
    const existing = await prisma.emailTemplate.findUnique({ where: { kind: input.kind }, select: { variables: true } });
    const varErrors = checkVariables(input.kind, existing?.variables, input);
    if (varErrors) return fail("The template uses variables that are not available for this email.", varErrors);
    const [settings, env] = [await getSiteSettings(), getEnv()];
    const vars = sampleVariables(allowedVariables(input.kind, existing?.variables), { productName: settings["branding.productName"], supportEmail: settings["branding.supportEmail"], appUrl: env.APP_URL });
    const branding = { productName: settings["branding.productName"], primaryColor: settings["branding.primaryColor"], accentColor: settings["branding.accentColor"], footerText: settings["email.footerText"], appUrl: env.APP_URL };
    const html = renderEmailHtml(substituteVariables(input.bodyMarkdown, vars), branding, input.previewText ? substituteVariables(input.previewText, vars) : undefined);
    return ok({ subject: substituteVariables(input.subject, vars), html });
  });
}

export async function sendTestEmailAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = parseTemplateForm(formData);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const input = parsed.data;
    const existing = await prisma.emailTemplate.findUnique({ where: { kind: input.kind }, select: { variables: true } });
    const varErrors = checkVariables(input.kind, existing?.variables, input);
    if (varErrors) return fail("The template uses variables that are not available for this email.", varErrors);
    const [settings, env] = [await getSiteSettings(), getEnv()];
    const vars = sampleVariables(allowedVariables(input.kind, existing?.variables), { productName: settings["branding.productName"], supportEmail: settings["branding.supportEmail"], appUrl: env.APP_URL });
    const outcome = await sendEmail({ kind: input.kind, to: admin.user.email, userId: admin.user.id, variables: vars, templateOverride: { subject: input.subject, bodyMarkdown: input.bodyMarkdown, previewText: input.previewText || null }, metadata: { test: true, byAdmin: admin.user.id } });
    await adminAudit(admin, { action: "email_template.test_send", targetType: "email_template", targetId: input.kind, newValue: { to: admin.user.email, status: outcome.status, emailEventId: outcome.emailEventId } });
    if (outcome.status === "FAILED") return fail(`Sending failed: ${outcome.error ?? "unknown error"}`);
    if (outcome.previewMode) return ok(undefined, "Email rendered in preview mode (no delivery provider configured). See email activity for the preview.");
    return ok(undefined, `Test email sent to ${admin.user.email}.`);
  });
}
