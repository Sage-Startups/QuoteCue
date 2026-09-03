import type { ZodType } from "zod";

export interface AiImageInput {
  /** Data URL (data:image/jpeg;base64,...) or https URL reachable by the provider. */
  dataUrl: string;
  detail?: "low" | "high" | "auto";
}

export interface StructuredRequest<T> {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  images?: AiImageInput[];
  schema: ZodType<T>;
  schemaName: string;
  timeoutMs?: number;
  /** For the mock provider: hints that shape fixture output. */
  fixtureHint?: Record<string, unknown>;
}

export interface StructuredResponse<T> {
  data: T;
  rawText: string | null;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface TranscriptionRequest {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  model: string;
  timeoutMs?: number;
}

export interface TranscriptionResponse {
  text: string;
  durationSeconds: number | null;
  model: string;
}

export interface AiProvider {
  readonly name: "openai" | "mock";
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResponse<T>>;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

export class AiProviderError extends Error {
  readonly category: "TIMEOUT" | "RATE_LIMIT" | "VALIDATION" | "PROVIDER" | "NETWORK" | "CONFIG" | "UNKNOWN";
  readonly retryable: boolean;
  constructor(message: string, category: AiProviderError["category"], retryable = false) {
    super(message);
    this.name = "AiProviderError";
    this.category = category;
    this.retryable = retryable;
  }
}
