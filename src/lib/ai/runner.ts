import type { ZodType } from "zod";
import type { AiErrorCategory, AiFeature } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSiteSettings } from "@/lib/config/site-settings";
import { substituteVariables } from "@/lib/email/render";
import { getAiProvider } from "./index";
import { AiProviderError, type AiImageInput } from "./provider";
import { DEFAULT_PROMPTS } from "./prompts";
import { recordApplicationError } from "@/lib/services/app-events";

export interface AiRunInput<T> {
  feature: AiFeature;
  workspaceId?: string | null;
  userId?: string | null;
  quoteId?: string | null;
  variables: Record<string, string | number | null | undefined>;
  schema: ZodType<T>;
  schemaName: string;
  images?: AiImageInput[];
  fixtureHint?: Record<string, unknown>;
  idempotencyKey?: string;
  /** Overrides for the prompt (used by the super-admin prompt tester). */
  promptOverride?: { systemPrompt: string; userTemplate: string; model?: string | null };
  useVisionModel?: boolean;
}

export interface AiRunOutput<T> {
  data: T;
  runId: string;
  model: string;
  provider: "openai" | "mock";
  usage: { inputTokens: number; outputTokens: number };
  estimatedCostMicros: number;
}

export class AiRunError extends Error {
  readonly category: AiErrorCategory;
  readonly runId: string | null;
  constructor(message: string, category: AiErrorCategory, runId: string | null) {
    super(message);
    this.name = "AiRunError";
    this.category = category;
    this.runId = runId;
  }
}

export async function resolvePrompt(feature: AiFeature) {
  const published = await prisma.aiPromptVersion.findFirst({ where: { feature, isPublished: true } });
  if (published) {
    return { id: published.id, version: published.version, systemPrompt: published.systemPrompt, userTemplate: published.userTemplate, model: published.model };
  }
  const def = DEFAULT_PROMPTS[feature];
  return { id: null, version: 0, systemPrompt: def.systemPrompt, userTemplate: def.userTemplate, model: null };
}

export async function resolveModels() {
  const env = getEnv();
  const settings = await getSiteSettings();
  return {
    text: settings["ai.textModel"] || env.OPENAI_TEXT_MODEL,
    vision: settings["ai.visionModel"] || env.OPENAI_VISION_MODEL,
    transcribe: settings["ai.transcribeModel"] || env.OPENAI_TRANSCRIBE_MODEL,
    inputCostCentsPerMillion: settings["ai.inputCostCentsPerMillionTokens"],
    outputCostCentsPerMillion: settings["ai.outputCostCentsPerMillionTokens"],
    transcriptionCostCentsPerMinute: settings["ai.transcriptionCostCentsPerMinute"],
    enabled: settings["ai.enabled"],
  };
}

/** Estimated cost in micro-dollars (1e-6 USD) from token usage. */
export function estimateCostMicros(usage: { inputTokens: number; outputTokens: number; audioSeconds?: number }, rates: { inputCostCentsPerMillion: number; outputCostCentsPerMillion: number; transcriptionCostCentsPerMinute: number }): number {
  const input = (usage.inputTokens / 1_000_000) * rates.inputCostCentsPerMillion * 10_000;
  const output = (usage.outputTokens / 1_000_000) * rates.outputCostCentsPerMillion * 10_000;
  const audio = ((usage.audioSeconds ?? 0) / 60) * rates.transcriptionCostCentsPerMinute * 10_000;
  return Math.round(input + output + audio);
}

const RETRYABLE_ATTEMPTS = 2;

/**
 * Runs a structured AI feature: resolves the prompt, calls the provider with
 * retries, validates the result with Zod (attempting one structured repair on
 * failure) and records an AiRun row. Credit consumption is the caller's
 * responsibility and must only happen after this function succeeds.
 */
export async function runStructuredAi<T>(input: AiRunInput<T>): Promise<AiRunOutput<T>> {
  const provider = getAiProvider();
  const models = await resolveModels();
  if (!models.enabled && input.feature !== "PROMPT_TEST") {
    throw new AiRunError("AI features are currently disabled by the administrator.", "CONFIG", null);
  }
  const prompt = input.promptOverride ? { id: null, version: 0, ...input.promptOverride, model: input.promptOverride.model ?? null } : await resolvePrompt(input.feature);
  const model = prompt.model || (input.useVisionModel || (input.images?.length ?? 0) > 0 ? models.vision : models.text);

  const systemPrompt = prompt.systemPrompt;
  const userPrompt = substituteVariables(prompt.userTemplate, input.variables);

  const run = await prisma.aiRun.create({
    data: {
      feature: input.feature,
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      quoteId: input.quoteId ?? null,
      provider: provider.name,
      model,
      promptVersionId: prompt.id,
      promptVersionNo: prompt.version,
      status: "RUNNING",
      idempotencyKey: input.idempotencyKey,
      metadata: { imageCount: input.images?.length ?? 0 },
    },
    select: { id: true, startedAt: true },
  });

  const started = Date.now();
  let usage = { inputTokens: 0, outputTokens: 0 };

  const finishFailure = async (category: AiErrorCategory, message: string) => {
    await prisma.aiRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorCategory: category,
        errorMessage: message.slice(0, 1000),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostMicros: estimateCostMicros(usage, models),
        completedAt: new Date(),
        durationMs: Date.now() - started,
      },
    });
  };

  try {
    let lastError: unknown;
    let result: Awaited<ReturnType<typeof provider.generateStructured<T>>> | null = null;
    for (let attempt = 1; attempt <= RETRYABLE_ATTEMPTS; attempt++) {
      try {
        result = await provider.generateStructured<T>({
          model,
          systemPrompt,
          userPrompt,
          images: input.images,
          schema: input.schema,
          schemaName: input.schemaName,
          fixtureHint: input.fixtureHint,
        });
        usage = { inputTokens: usage.inputTokens + result.usage.inputTokens, outputTokens: usage.outputTokens + result.usage.outputTokens };
        break;
      } catch (error) {
        lastError = error;
        if (error instanceof AiProviderError && error.retryable && attempt < RETRYABLE_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
          continue;
        }
        throw error;
      }
    }
    if (!result) throw lastError ?? new AiProviderError("AI request failed", "UNKNOWN");

    // Re-validate defensively even though the provider parsed the output.
    let validated = input.schema.safeParse(result.data);
    if (!validated.success) {
      // One structured repair attempt: ask the model to fix the exact issues.
      const issues = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      const repair = await provider.generateStructured<T>({
        model,
        systemPrompt: `${systemPrompt}\n\nYour previous response failed validation. Fix the listed problems and return a corrected response that strictly matches the schema.`,
        userPrompt: `${userPrompt}\n\nPrevious response:\n${result.rawText ?? JSON.stringify(result.data)}\n\nValidation problems: ${issues}`,
        images: input.images,
        schema: input.schema,
        schemaName: input.schemaName,
        fixtureHint: input.fixtureHint,
      });
      usage = { inputTokens: usage.inputTokens + repair.usage.inputTokens, outputTokens: usage.outputTokens + repair.usage.outputTokens };
      validated = input.schema.safeParse(repair.data);
      if (!validated.success) {
        await finishFailure("VALIDATION", `AI output failed validation after repair: ${issues}`);
        throw new AiRunError("The AI response could not be validated. No credit has been used; please try again.", "VALIDATION", run.id);
      }
    }

    const estimatedCostMicros = estimateCostMicros(usage, models);
    await prisma.aiRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        model: result.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostMicros,
        completedAt: new Date(),
        durationMs: Date.now() - started,
      },
    });
    return { data: validated.data, runId: run.id, model: result.model, provider: provider.name, usage, estimatedCostMicros };
  } catch (error) {
    if (error instanceof AiRunError) throw error;
    const category: AiErrorCategory = error instanceof AiProviderError ? error.category : "UNKNOWN";
    const message = error instanceof Error ? error.message : "Unknown AI error";
    await finishFailure(category, message);
    await recordApplicationError("ai.run", error, { feature: input.feature, runId: run.id });
    throw new AiRunError(
      error instanceof AiProviderError ? `${error.message} No credit has been used.` : "The AI request failed. No credit has been used; please try again.",
      category,
      run.id,
    );
  }
}

export async function runTranscription(input: {
  workspaceId?: string | null;
  userId?: string | null;
  quoteId?: string | null;
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ text: string; runId: string; durationSeconds: number | null; provider: "openai" | "mock" }> {
  const provider = getAiProvider();
  const models = await resolveModels();
  if (!models.enabled) throw new AiRunError("AI features are currently disabled by the administrator.", "CONFIG", null);
  const run = await prisma.aiRun.create({
    data: {
      feature: "TRANSCRIPTION",
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      quoteId: input.quoteId ?? null,
      provider: provider.name,
      model: models.transcribe,
      status: "RUNNING",
      metadata: { bytes: input.buffer.length, mimeType: input.mimeType },
    },
    select: { id: true },
  });
  const started = Date.now();
  try {
    const result = await provider.transcribe({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType, model: models.transcribe });
    const audioSeconds = result.durationSeconds ?? Math.round(input.buffer.length / 16_000);
    await prisma.aiRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        audioSeconds,
        estimatedCostMicros: estimateCostMicros({ inputTokens: 0, outputTokens: 0, audioSeconds }, models),
        completedAt: new Date(),
        durationMs: Date.now() - started,
      },
    });
    return { text: result.text, runId: run.id, durationSeconds: result.durationSeconds, provider: provider.name };
  } catch (error) {
    const category: AiErrorCategory = error instanceof AiProviderError ? error.category : "UNKNOWN";
    await prisma.aiRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorCategory: category, errorMessage: (error as Error).message?.slice(0, 1000), completedAt: new Date(), durationMs: Date.now() - started },
    });
    throw new AiRunError("Transcription failed. Please try again or type the notes instead.", category, run.id);
  }
}
