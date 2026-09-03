import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputItem, ResponseInputContent } from "openai/resources/responses/responses";
import { AiProviderError, type AiProvider, type StructuredRequest, type StructuredResponse, type TranscriptionRequest, type TranscriptionResponse } from "./provider";

/** Official OpenAI SDK provider using the Responses API with structured outputs. */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 0 });
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const content: ResponseInputContent[] = [{ type: "input_text", text: request.userPrompt }];
    for (const image of request.images ?? []) {
      content.push({ type: "input_image", image_url: image.dataUrl, detail: image.detail ?? "low" });
    }
    const input: ResponseInputItem[] = [
      { role: "system", content: request.systemPrompt },
      { role: "user", content },
    ];
    try {
      const response = await this.client.responses.parse(
        {
          model: request.model,
          input,
          text: { format: zodTextFormat(request.schema, request.schemaName) },
          store: false,
        },
        { timeout: request.timeoutMs ?? 90_000 },
      );
      const parsed = response.output_parsed;
      if (!parsed) {
        throw new AiProviderError("The model returned no structured output", "VALIDATION");
      }
      return {
        data: parsed as T,
        rawText: response.output_text ?? null,
        usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
        model: response.model ?? request.model,
      };
    } catch (error) {
      throw translateError(error);
    }
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    try {
      const file = await toFile(request.buffer, request.filename, { type: request.mimeType });
      const result = await this.client.audio.transcriptions.create(
        { file, model: request.model, response_format: "json" },
        { timeout: request.timeoutMs ?? 120_000 },
      );
      return { text: result.text ?? "", durationSeconds: null, model: request.model };
    } catch (error) {
      throw translateError(error);
    }
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.client.models.list({ timeout: 10_000 });
      return { ok: true, message: "OpenAI API reachable" };
    } catch (error) {
      return { ok: false, message: translateError(error).message };
    }
  }
}

function translateError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new AiProviderError("The AI request timed out. Please try again.", "TIMEOUT", true);
  if (error instanceof OpenAI.RateLimitError) return new AiProviderError("The AI service is busy. Please try again in a moment.", "RATE_LIMIT", true);
  if (error instanceof OpenAI.AuthenticationError) return new AiProviderError("The AI service rejected the API key.", "CONFIG");
  if (error instanceof OpenAI.APIConnectionError) return new AiProviderError("Could not reach the AI service.", "NETWORK", true);
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    return new AiProviderError(`AI service error (${status}): ${error.message}`, status >= 500 ? "PROVIDER" : "VALIDATION", status >= 500);
  }
  return new AiProviderError((error as Error)?.message ?? "Unknown AI error", "UNKNOWN");
}
