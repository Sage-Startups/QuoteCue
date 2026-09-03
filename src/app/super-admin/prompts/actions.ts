"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";
import { runStructuredAi, AiRunError } from "@/lib/ai/runner";
import { promptTestSchema } from "@/lib/ai/schemas";
import { findUnsupportedVariables } from "@/lib/email/render";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { adminAction, adminAudit } from "../_lib/admin";
import type { AiFeature } from "@/generated/prisma/enums";

const EDITABLE_FEATURES = (Object.keys(DEFAULT_PROMPTS) as AiFeature[]).filter((f) => f !== "TRANSCRIPTION");
const featureSchema = z.enum(EDITABLE_FEATURES as [AiFeature, ...AiFeature[]]);
const idSchema = z.string().uuid("Invalid id");
const modelSchema = z
  .string()
  .trim()
  .max(80)
  .regex(/^[A-Za-z0-9._:-]*$/, "Model names may only contain letters, numbers, dots, dashes and colons");

function revalidate(feature: string) {
  revalidatePath("/super-admin/prompts");
  revalidatePath(`/super-admin/prompts/${feature}`);
}

export async function createPromptVersionAction(formData: FormData): Promise<ActionResult<{ id: string; version: number }>> {
  return adminAction<{ id: string; version: number }>(async (admin) => {
    const feature = featureSchema.safeParse(formData.get("feature"));
    if (!feature.success) return fail("Unknown feature.");
    const latest = await prisma.aiPromptVersion.findFirst({ where: { feature: feature.data }, orderBy: { version: "desc" } });
    const def = DEFAULT_PROMPTS[feature.data];
    const source = latest ?? { systemPrompt: def.systemPrompt, userTemplate: def.userTemplate, model: null, version: 0 };
    const created = await prisma.aiPromptVersion.create({ data: { feature: feature.data, version: source.version + 1, systemPrompt: source.systemPrompt, userTemplate: source.userTemplate, model: source.model, notes: latest ? `Copied from version ${latest.version}` : "Copied from the built-in default", isPublished: false, createdById: admin.user.id } });
    await adminAudit(admin, { action: "prompt.version.create", targetType: "ai_prompt", targetId: created.id, newValue: { feature: feature.data, version: created.version, copiedFrom: latest?.id ?? "default" } });
    revalidate(feature.data);
    return ok({ id: created.id, version: created.version }, `Version ${created.version} created (unpublished).`);
  });
}

const updateSchema = z.object({ versionId: idSchema, systemPrompt: z.string().min(1, "System prompt is required").max(20000), userTemplate: z.string().min(1, "User template is required").max(20000), model: modelSchema, notes: z.string().trim().max(1000) });

export async function updatePromptVersionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = updateSchema.safeParse({ versionId: formData.get("versionId"), systemPrompt: formData.get("systemPrompt"), userTemplate: formData.get("userTemplate"), model: formData.get("model") ?? "", notes: formData.get("notes") ?? "" });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const version = await prisma.aiPromptVersion.findUnique({ where: { id: parsed.data.versionId } });
    if (!version) return fail("Prompt version not found.");
    if (version.isPublished) return fail("Published versions are read-only. Create a new version to make changes.");
    const allowed = DEFAULT_PROMPTS[version.feature].variables;
    const fieldErrors: Record<string, string[]> = {};
    for (const field of ["systemPrompt", "userTemplate"] as const) {
      const unsupported = findUnsupportedVariables(parsed.data[field], allowed);
      if (unsupported.length > 0) fieldErrors[field] = [`Unsupported variable${unsupported.length === 1 ? "" : "s"}: ${unsupported.map((v) => `{{${v}}}`).join(", ")}`];
    }
    if (Object.keys(fieldErrors).length > 0) return fail("The prompt uses variables that are not available for this feature.", fieldErrors);
    const data = { systemPrompt: parsed.data.systemPrompt, userTemplate: parsed.data.userTemplate, model: parsed.data.model || null, notes: parsed.data.notes || null };
    await prisma.aiPromptVersion.update({ where: { id: version.id }, data });
    await adminAudit(admin, { action: "prompt.version.update", targetType: "ai_prompt", targetId: version.id, previousValue: { feature: version.feature, version: version.version, systemPrompt: version.systemPrompt, userTemplate: version.userTemplate, model: version.model, notes: version.notes }, newValue: { feature: version.feature, version: version.version, ...data } });
    revalidate(version.feature);
    return ok(undefined, `Version ${version.version} saved.`);
  });
}

/** Publishes one version (also used for rollbacks to an older version). Exactly one version per feature is published. */
export async function publishPromptVersionAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const id = idSchema.safeParse(formData.get("versionId"));
    if (!id.success) return fail("Invalid version.");
    const version = await prisma.aiPromptVersion.findUnique({ where: { id: id.data } });
    if (!version) return fail("Prompt version not found.");
    if (version.isPublished) return fail("This version is already published.");
    const allowed = DEFAULT_PROMPTS[version.feature].variables;
    const unsupported = findUnsupportedVariables(`${version.systemPrompt}\n${version.userTemplate}`, allowed);
    if (unsupported.length > 0) return fail(`Cannot publish: unsupported variables ${unsupported.map((v) => `{{${v}}}`).join(", ")}.`);
    const previous = await prisma.aiPromptVersion.findFirst({ where: { feature: version.feature, isPublished: true }, select: { id: true, version: true } });
    await prisma.$transaction([
      prisma.aiPromptVersion.updateMany({ where: { feature: version.feature, isPublished: true }, data: { isPublished: false } }),
      prisma.aiPromptVersion.update({ where: { id: version.id }, data: { isPublished: true, publishedAt: new Date() } }),
    ]);
    const isRollback = previous ? previous.version > version.version : false;
    await adminAudit(admin, { action: isRollback ? "prompt.rollback" : "prompt.publish", targetType: "ai_prompt", targetId: version.id, previousValue: previous ? { publishedVersionId: previous.id, version: previous.version } : null, newValue: { feature: version.feature, publishedVersionId: version.id, version: version.version } });
    revalidate(version.feature);
    return ok(undefined, `Version ${version.version} is now live for ${version.feature.toLowerCase().replace(/_/g, " ")}.`);
  });
}

export async function deletePromptVersionAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const id = idSchema.safeParse(formData.get("versionId"));
    if (!id.success) return fail("Invalid version.");
    const version = await prisma.aiPromptVersion.findUnique({ where: { id: id.data }, include: { _count: { select: { runs: true } } } });
    if (!version) return fail("Prompt version not found.");
    if (version.isPublished) return fail("Published versions cannot be deleted. Publish another version first.");
    await prisma.aiPromptVersion.delete({ where: { id: version.id } });
    await adminAudit(admin, { action: "prompt.version.delete", targetType: "ai_prompt", targetId: version.id, previousValue: { feature: version.feature, version: version.version, systemPrompt: version.systemPrompt, userTemplate: version.userTemplate, model: version.model, notes: version.notes, runs: version._count.runs }, newValue: null });
    revalidate(version.feature);
    return ok(undefined, `Version ${version.version} deleted.`);
  });
}

export interface PromptTestOutput {
  output: string;
  model: string;
  provider: "openai" | "mock";
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  versionLabel: string;
}

const testSchema = z.object({ feature: featureSchema, versionId: idSchema.or(z.literal("")), input: z.string().trim().min(1, "Enter some sample input").max(8000) });

/** Runs the selected prompt version (or the built-in default) against sample input. Does not consume credits. */
export async function testPromptAction(_prev: ActionResult<PromptTestOutput> | null, formData: FormData): Promise<ActionResult<PromptTestOutput>> {
  return adminAction<PromptTestOutput>(async (admin) => {
    const parsed = testSchema.safeParse({ feature: formData.get("feature"), versionId: formData.get("versionId") ?? "", input: formData.get("input") });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    let systemPrompt: string;
    let userTemplateSample: string;
    let model: string | null = null;
    let versionLabel: string;
    if (parsed.data.versionId) {
      const version = await prisma.aiPromptVersion.findUnique({ where: { id: parsed.data.versionId } });
      if (!version || version.feature !== parsed.data.feature) return fail("Prompt version not found.");
      systemPrompt = version.systemPrompt;
      userTemplateSample = version.userTemplate;
      model = version.model;
      versionLabel = `v${version.version}${version.isPublished ? " (published)" : ""}`;
    } else {
      const def = DEFAULT_PROMPTS[parsed.data.feature];
      systemPrompt = def.systemPrompt;
      userTemplateSample = def.userTemplate;
      versionLabel = "built-in default";
    }
    try {
      const result = await runStructuredAi({
        feature: "PROMPT_TEST",
        userId: admin.user.id,
        schema: promptTestSchema,
        schemaName: "prompt_test",
        variables: { input: parsed.data.input },
        promptOverride: { systemPrompt, userTemplate: `{{input}}\n\n---\nUser template for reference (variables are not substituted in this test):\n${userTemplateSample}`, model },
      });
      await adminAudit(admin, { action: "prompt.test", targetType: "ai_prompt", targetId: parsed.data.versionId || parsed.data.feature, newValue: { feature: parsed.data.feature, runId: result.runId, model: result.model, provider: result.provider } });
      return ok({ output: result.data.output, model: result.model, provider: result.provider, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostMicros: result.estimatedCostMicros, versionLabel });
    } catch (error) {
      if (error instanceof AiRunError) return fail(`${error.message} (${error.category})`);
      throw error;
    }
  });
}
