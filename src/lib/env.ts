import { z } from "zod";

/**
 * Environment validation.
 *
 * The application refuses to start in production with mock providers or local
 * file storage. In development, missing paid credentials switch the relevant
 * provider into a clearly labelled mock mode.
 */

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: optionalString,

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: optionalString,
  SUPER_ADMIN_EMAIL: optionalString,

  STORAGE_PROVIDER: z.enum(["railway", "s3", "local", "memory"]).default("local"),
  STORAGE_BUCKET: optionalString,
  STORAGE_ENDPOINT: optionalString,
  STORAGE_REGION: optionalString,
  STORAGE_ACCESS_KEY_ID: optionalString,
  STORAGE_SECRET_ACCESS_KEY: optionalString,
  STORAGE_FORCE_PATH_STYLE: booleanish,
  LOCAL_STORAGE_PATH: z.string().default(".local-storage"),

  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_STARTER_MONTHLY_PRICE_ID: optionalString,
  STRIPE_STARTER_ANNUAL_PRICE_ID: optionalString,
  STRIPE_PRO_MONTHLY_PRICE_ID: optionalString,
  STRIPE_PRO_ANNUAL_PRICE_ID: optionalString,
  STRIPE_CREDIT_PACK_PRICE_ID: optionalString,

  OPENAI_API_KEY: optionalString,
  OPENAI_TEXT_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_VISION_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-4o-mini-transcribe"),

  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("QuoteCue AI <noreply@example.com>"),
  SUPPORT_EMAIL: z.string().default("support@example.com"),

  DEMO_MODE: booleanish,
  ANALYTICS_ID: optionalString,

  /** Explicit opt-in for mock providers in test environments. */
  ALLOW_MOCK_PROVIDERS: booleanish,
});

export type Env = z.infer<typeof envSchema> & {
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  providers: {
    ai: "openai" | "mock";
    email: "resend" | "preview";
    stripe: "stripe" | "mock";
    storage: "railway" | "s3" | "local" | "memory";
  };
};

let cached: Env | undefined;

function resolveProviders(env: z.infer<typeof envSchema>): Env["providers"] {
  return {
    ai: env.OPENAI_API_KEY ? "openai" : "mock",
    email: env.RESEND_API_KEY ? "resend" : "preview",
    stripe: env.STRIPE_SECRET_KEY ? "stripe" : "mock",
    storage: env.STORAGE_PROVIDER,
  };
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";
  const providers = resolveProviders(env);
  // During `next build` no services are contacted, so provider strictness is skipped.
  const isBuildPhase = source.NEXT_PHASE === "phase-production-build" || source.SKIP_ENV_VALIDATION === "1";

  if (isProduction && !env.ALLOW_MOCK_PROVIDERS && !isBuildPhase) {
    const problems: string[] = [];
    if (providers.ai === "mock") problems.push("OPENAI_API_KEY is missing (mock AI is not allowed in production).");
    if (providers.email === "preview") problems.push("RESEND_API_KEY is missing (email preview mode is not allowed in production).");
    if (providers.stripe === "mock") problems.push("STRIPE_SECRET_KEY is missing (mock billing is not allowed in production).");
    if (!env.STRIPE_WEBHOOK_SECRET) problems.push("STRIPE_WEBHOOK_SECRET is missing.");
    if (providers.storage === "local" || providers.storage === "memory") {
      problems.push("STORAGE_PROVIDER must be 'railway' or 's3' in production (local filesystem storage is not permanent).");
    }
    if (!env.APP_URL.startsWith("https://")) problems.push("APP_URL must use https in production.");
    if (problems.length > 0) {
      throw new Error(`Refusing to start in production:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    }
  }

  if (providers.storage === "railway" || providers.storage === "s3") {
    const missing = (
      ["STORAGE_BUCKET", "STORAGE_ENDPOINT", "STORAGE_REGION", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] as const
    ).filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(`STORAGE_PROVIDER=${providers.storage} requires: ${missing.join(", ")}`);
    }
  }

  return {
    ...env,
    isProduction,
    isDevelopment: env.NODE_ENV === "development",
    isTest: env.NODE_ENV === "test",
    providers,
  };
}

export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/** For tests only: clears the cached environment. */
export function resetEnvCache(): void {
  cached = undefined;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: keyof Env) {
    return getEnv()[prop];
  },
});
