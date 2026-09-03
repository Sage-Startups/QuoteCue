import { getEnv } from "@/lib/env";
import { MockAiProvider } from "./mock-provider";
import { OpenAiProvider } from "./openai-provider";
import type { AiProvider } from "./provider";

const globalRef = globalThis as unknown as { __aiProvider?: AiProvider };

export function getAiProvider(): AiProvider {
  if (globalRef.__aiProvider) return globalRef.__aiProvider;
  const env = getEnv();
  const provider: AiProvider = env.OPENAI_API_KEY ? new OpenAiProvider(env.OPENAI_API_KEY) : new MockAiProvider();
  globalRef.__aiProvider = provider;
  return provider;
}

export function setAiProvider(provider: AiProvider | undefined): void {
  globalRef.__aiProvider = provider;
}

export { AiProviderError } from "./provider";
export type { AiProvider, AiImageInput } from "./provider";
export * from "./schemas";
export { DEFAULT_PROMPTS } from "./prompts";
