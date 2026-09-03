import type { AiProvider, StructuredRequest, StructuredResponse, TranscriptionRequest, TranscriptionResponse } from "./provider";
import { buildMockFixture } from "./mock-fixtures";

/**
 * Development and demo provider. Produces realistic, deterministic fixture
 * responses based on keywords in the prompt. Never used in production.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock" as const;

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const fixture = buildMockFixture(request.schemaName, request.userPrompt, request.fixtureHint ?? {});
    const data = request.schema.parse(fixture);
    // Simulate a little latency so loading states are visible.
    await new Promise((r) => setTimeout(r, 150));
    return {
      data,
      rawText: JSON.stringify(fixture),
      usage: { inputTokens: Math.ceil(request.userPrompt.length / 4), outputTokens: Math.ceil(JSON.stringify(fixture).length / 4) },
      model: "mock-quotecue-v1",
    };
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    await new Promise((r) => setTimeout(r, 120));
    const seconds = Math.max(5, Math.min(180, Math.round(request.buffer.length / 16_000)));
    return {
      text: "Hi, it's about the job we spoke about. The customer wants two new double sockets in the living room, one on each side of the chimney breast, and the old light fitting in the hallway replaced with an LED panel. The consumer unit is in the garage. They'd like it done before the end of the month.",
      durationSeconds: seconds,
      model: "mock-transcribe-v1",
    };
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: "Mock AI provider active: OPENAI_API_KEY is not configured. Responses are fixtures." };
  }
}
