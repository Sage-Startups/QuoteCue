import { getEnv } from "@/lib/env";
import { signLocalUrl } from "./signed-url";
import type { ObjectHead, PresignedUpload, StorageProvider } from "./types";

const globalStore = globalThis as unknown as { __memoryStorage?: Map<string, { body: Buffer; contentType: string }> };
const store = (globalStore.__memoryStorage ??= new Map());

/** In-memory storage for automated tests. Contents disappear with the process. */
export class InMemoryStorage implements StorageProvider {
  readonly name = "memory" as const;
  readonly bucket = "memory";

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    store.set(key, { body, contentType });
  }

  async getObject(key: string) {
    const entry = store.get(key);
    return entry ? { body: entry.body, contentType: entry.contentType } : null;
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    const entry = store.get(key);
    return entry ? { sizeBytes: entry.body.length, contentType: entry.contentType } : null;
  }

  async deleteObject(key: string): Promise<void> {
    store.delete(key);
  }

  async createPresignedUpload(key: string, contentType: string, expiresInSeconds: number): Promise<PresignedUpload> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const url = new URL("/api/storage/local/upload", getEnv().APP_URL);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(expiresAt));
    url.searchParams.set("ct", contentType);
    url.searchParams.set("sig", signLocalUrl("upload", key, expiresAt, contentType));
    return { url: url.toString(), method: "PUT", headers: { "Content-Type": contentType }, expiresAt: new Date(expiresAt) };
  }

  async createPresignedDownload(key: string, expiresInSeconds: number, options?: { filename?: string }): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const url = new URL("/api/storage/local/object", getEnv().APP_URL);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(expiresAt));
    url.searchParams.set("sig", signLocalUrl("download", key, expiresAt));
    if (options?.filename) url.searchParams.set("filename", options.filename);
    return url.toString();
  }

  async healthCheck() {
    return { ok: true, message: `In-memory storage (${store.size} objects, tests only)` };
  }

  static clear(): void {
    store.clear();
  }
}
