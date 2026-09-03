import { prisma } from "@/lib/db";
import { RateLimitError } from "@/lib/utils/result";

export interface RateLimitRule {
  /** Maximum requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

export const RATE_LIMITS = {
  registration: { limit: 5, windowSeconds: 600 },
  login: { limit: 10, windowSeconds: 600 },
  passwordReset: { limit: 5, windowSeconds: 900 },
  magicLink: { limit: 5, windowSeconds: 900 },
  aiGeneration: { limit: 20, windowSeconds: 600 },
  publicQuote: { limit: 60, windowSeconds: 300 },
  publicQuoteDecision: { limit: 10, windowSeconds: 600 },
  contactForm: { limit: 3, windowSeconds: 900 },
  emailSend: { limit: 30, windowSeconds: 3600 },
  presign: { limit: 60, windowSeconds: 600 },
  invite: { limit: 20, windowSeconds: 3600 },
  export: { limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/**
 * Fixed-window rate limiter backed by PostgreSQL so it works across several
 * application instances. The bucket table is cleaned up by the cron runner.
 */
export async function checkRateLimit(scope: RateLimitKey | string, identifier: string, rule?: RateLimitRule): Promise<RateLimitResult> {
  const resolvedRule: RateLimitRule = rule ?? (RATE_LIMITS as Record<string, RateLimitRule>)[scope] ?? { limit: 30, windowSeconds: 60 };
  const now = Date.now();
  const windowMs = resolvedRule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const key = `${scope}:${identifier}`;

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  const allowed = bucket.count <= resolvedRule.limit;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
  return {
    allowed,
    remaining: Math.max(0, resolvedRule.limit - bucket.count),
    retryAfterSeconds,
    limit: resolvedRule.limit,
  };
}

export async function enforceRateLimit(scope: RateLimitKey | string, identifier: string, rule?: RateLimitRule): Promise<void> {
  const result = await checkRateLimit(scope, identifier, rule);
  if (!result.allowed) {
    throw new RateLimitError(`Too many requests. Please try again in ${result.retryAfterSeconds} seconds.`);
  }
}

export async function cleanupRateLimitBuckets(olderThan: Date): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: olderThan } } });
  return result.count;
}
