import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "@/lib/env";
import { setStorageProvider } from "@/lib/storage";
import { corsAllowsOrigin, ensureUploadCorsPolicy, resetCorsPolicyCache, supportsCors, uploadOrigins } from "@/lib/storage/cors";
import type { CorsRule, StorageProvider } from "@/lib/storage/types";

function baseEnv(overrides: Record<string, string> = {}) {
  return loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/quotecue_test",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
    APP_URL: "https://quotecue.example.com",
    STORAGE_PROVIDER: "memory",
    ALLOW_MOCK_PROVIDERS: "true",
    ...overrides,
  } as NodeJS.ProcessEnv);
}

/** A provider that records what the app tried to do to the bucket policy. */
function fakeBucket(initial: CorsRule[] | Error = []) {
  const put = vi.fn(async (origins: string[]) => {
    state = [{ origins, methods: ["GET", "PUT", "HEAD"] }];
  });
  let state: CorsRule[] = initial instanceof Error ? [] : initial;
  const provider = {
    name: "s3",
    bucket: "test",
    putCorsPolicy: put,
    getCorsPolicy: async () => {
      if (initial instanceof Error) throw initial;
      return state;
    },
  } as unknown as StorageProvider;
  return { provider, put, current: () => state };
}

afterEach(() => {
  setStorageProvider(undefined);
  resetCorsPolicyCache();
  vi.restoreAllMocks();
});

describe("upload origins", () => {
  it("uses APP_URL, normalised to an origin", () => {
    expect(uploadOrigins(baseEnv({ APP_URL: "https://quotecue.example.com/app/" }))).toEqual(["https://quotecue.example.com"]);
  });

  it("adds the extra origins a second domain needs, without duplicates", () => {
    const origins = uploadOrigins(baseEnv({ STORAGE_CORS_ORIGINS: "https://www.example.com, https://quotecue.example.com ," }));
    expect(origins).toEqual(["https://quotecue.example.com", "https://www.example.com"]);
  });
});

describe("corsAllowsOrigin", () => {
  const rules: CorsRule[] = [{ origins: ["https://quotecue.example.com"], methods: ["GET", "PUT", "HEAD"] }];

  it("accepts the same origin whatever the trailing slash or case", () => {
    expect(corsAllowsOrigin(rules, "https://QuoteCue.example.com/")).toBe(true);
  });

  it("rejects a different host, which is what breaks uploads on a custom domain", () => {
    expect(corsAllowsOrigin(rules, "https://www.example.com")).toBe(false);
  });

  it("rejects a rule that allows the origin but not PUT", () => {
    expect(corsAllowsOrigin([{ origins: ["*"], methods: ["GET"] }], "https://anything.example.com")).toBe(false);
  });

  it("accepts a wildcard origin", () => {
    expect(corsAllowsOrigin([{ origins: ["*"], methods: ["PUT"] }], "https://anything.example.com")).toBe(true);
  });
});

describe("ensureUploadCorsPolicy", () => {
  it("writes the policy when the bucket has none", async () => {
    const bucket = fakeBucket([]);
    setStorageProvider(bucket.provider);
    await ensureUploadCorsPolicy();
    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(bucket.current()[0]?.origins).toEqual(["http://localhost:3000"]);
  });

  it("leaves an adequate policy alone", async () => {
    const bucket = fakeBucket([{ origins: ["http://localhost:3000"], methods: ["GET", "PUT", "HEAD"] }]);
    setStorageProvider(bucket.provider);
    await ensureUploadCorsPolicy();
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("only asks the bucket once per process", async () => {
    const bucket = fakeBucket([]);
    setStorageProvider(bucket.provider);
    await Promise.all([ensureUploadCorsPolicy(), ensureUploadCorsPolicy()]);
    await ensureUploadCorsPolicy();
    expect(bucket.put).toHaveBeenCalledTimes(1);
  });

  it("logs and continues when the bucket refuses, so the upload still gets its URL", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const bucket = fakeBucket([]);
    bucket.put.mockRejectedValueOnce(new Error("AccessDenied"));
    setStorageProvider(bucket.provider);
    await expect(ensureUploadCorsPolicy()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it("does nothing for providers that serve files from this origin", async () => {
    setStorageProvider({ name: "local", bucket: "local" } as unknown as StorageProvider);
    await expect(ensureUploadCorsPolicy()).resolves.toBeUndefined();
    expect(supportsCors({ name: "local", bucket: "local" } as unknown as StorageProvider)).toBe(false);
  });
});
