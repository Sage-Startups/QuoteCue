import { getEnv, missingStorageCredentials } from "@/lib/env";
import { getStorage } from "./index";
import type { CorsCapableStorage, CorsRule, StorageProvider } from "./types";

/**
 * Presigned uploads go straight from the browser to the bucket, so the bucket
 * has to allow PUT from this site's origin. Nothing in a bucket dashboard shows
 * this, and when it is missing the browser blocks the request before it leaves:
 * the upload fails with an opaque network error and the bucket never sees it.
 * So the app applies the policy itself, once per process, rather than leaving it
 * as a manual step someone has to know about.
 */

/** How long to wait before trying again after a failed attempt. */
const RETRY_AFTER_FAILURE_MS = 5 * 60_000;

let attempt: { origins: string; ok: boolean; at: number; promise: Promise<void> } | null = null;

export function supportsCors(provider: StorageProvider): provider is StorageProvider & CorsCapableStorage {
  const candidate = provider as Partial<CorsCapableStorage>;
  return typeof candidate.putCorsPolicy === "function" && typeof candidate.getCorsPolicy === "function";
}

function normaliseOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * The origins browsers will upload from: this site, plus anything named in
 * STORAGE_CORS_ORIGINS. The extra list exists because APP_URL is a single
 * canonical URL, while a site can legitimately be reached on more than one
 * domain (a custom domain alongside the platform one, say).
 */
export function uploadOrigins(env = getEnv()): string[] {
  const extra = (env.STORAGE_CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = [env.APP_URL, ...extra].map(normaliseOrigin).filter((value) => /^https?:\/\//.test(value));
  return [...new Set(origins)];
}

/** True when the policy already lets this origin PUT, so nothing needs writing. */
export function corsAllowsOrigin(rules: CorsRule[], origin: string): boolean {
  const wanted = normaliseOrigin(origin);
  return rules.some(
    (rule) =>
      rule.methods.some((method) => method.toUpperCase() === "PUT") &&
      rule.origins.some((allowed) => allowed === "*" || normaliseOrigin(allowed) === wanted),
  );
}

/**
 * Makes sure the bucket allows browser uploads from this site. Safe to call on
 * every presign: the result is remembered for the life of the process, and a
 * failure is only retried every few minutes. Never throws — a bucket that
 * refuses to have its policy read or written is worth a log line, not a failed
 * upload, because the upload may well work anyway (the policy can have been set
 * out of band).
 */
export async function ensureUploadCorsPolicy(): Promise<void> {
  const env = getEnv();
  if (missingStorageCredentials(env).length > 0) return;
  const storage = getStorage();
  if (!supportsCors(storage)) return;
  const origins = uploadOrigins(env);
  if (origins.length === 0) return;

  const key = origins.join(" ");
  const now = Date.now();
  if (attempt && attempt.origins === key && (attempt.ok || now - attempt.at < RETRY_AFTER_FAILURE_MS)) {
    return attempt.promise;
  }

  const record: NonNullable<typeof attempt> = { origins: key, ok: false, at: now, promise: Promise.resolve() };
  record.promise = applyCorsPolicy(storage, origins).then(
    () => {
      record.ok = true;
    },
    (error: unknown) => {
      // Swallowed deliberately: see the doc comment above.
      console.error(`[storage] could not configure bucket CORS for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    },
  );
  attempt = record;
  return record.promise;
}

async function applyCorsPolicy(storage: StorageProvider & CorsCapableStorage, origins: string[]): Promise<void> {
  const current = await storage.getCorsPolicy().catch((error: unknown) => {
    // Some S3 implementations return an error rather than an empty policy when
    // none is set, which is indistinguishable here, so treat it as "none set".
    console.warn(`[storage] could not read the bucket CORS policy (${error instanceof Error ? error.message : String(error)}); applying ours.`);
    return [] as CorsRule[];
  });
  if (origins.every((origin) => corsAllowsOrigin(current, origin))) return;
  await storage.putCorsPolicy(origins);
  console.log(`[storage] bucket CORS now allows browser uploads from ${origins.join(", ")}.`);
}

/** Test hook: forget what this process has already tried. */
export function resetCorsPolicyCache(): void {
  attempt = null;
}
