import { promises as fs } from "node:fs";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { isSafeObjectKey } from "./keys";
import { signLocalUrl } from "./signed-url";
import type { ObjectHead, PresignedUpload, StorageProvider } from "./types";

/**
 * Development-only filesystem storage. Never used in production (the env
 * validator refuses it). Objects live under LOCAL_STORAGE_PATH, which is
 * git-ignored.
 */
export class LocalFileStorage implements StorageProvider {
  readonly name = "local" as const;
  readonly bucket: string;
  private readonly root: string;

  constructor(root?: string) {
    const env = getEnv();
    this.root = path.resolve(process.cwd(), root ?? env.LOCAL_STORAGE_PATH);
    this.bucket = "local";
  }

  private resolve(key: string): string {
    if (!isSafeObjectKey(key)) throw new Error("Unsafe object key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Object key escapes storage root");
    return full;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    await fs.writeFile(`${file}.meta.json`, JSON.stringify({ contentType }));
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string | null } | null> {
    const file = this.resolve(key);
    try {
      const body = await fs.readFile(file);
      let contentType: string | null = null;
      try {
        const meta = JSON.parse(await fs.readFile(`${file}.meta.json`, "utf8")) as { contentType?: string };
        contentType = meta.contentType ?? null;
      } catch {
        contentType = null;
      }
      return { body, contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    const file = this.resolve(key);
    try {
      const stat = await fs.stat(file);
      let contentType: string | null = null;
      try {
        const meta = JSON.parse(await fs.readFile(`${file}.meta.json`, "utf8")) as { contentType?: string };
        contentType = meta.contentType ?? null;
      } catch {
        contentType = null;
      }
      return { sizeBytes: stat.size, contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const file = this.resolve(key);
    await fs.rm(file, { force: true });
    await fs.rm(`${file}.meta.json`, { force: true });
  }

  async createPresignedUpload(key: string, contentType: string, expiresInSeconds: number): Promise<PresignedUpload> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const sig = signLocalUrl("upload", key, expiresAt, contentType);
    const url = new URL("/api/storage/local/upload", getEnv().APP_URL);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(expiresAt));
    url.searchParams.set("ct", contentType);
    url.searchParams.set("sig", sig);
    return { url: url.toString(), method: "PUT", headers: { "Content-Type": contentType }, expiresAt: new Date(expiresAt) };
  }

  async createPresignedDownload(key: string, expiresInSeconds: number, options?: { filename?: string; contentType?: string }): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const sig = signLocalUrl("download", key, expiresAt);
    const url = new URL("/api/storage/local/object", getEnv().APP_URL);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(expiresAt));
    url.searchParams.set("sig", sig);
    if (options?.filename) url.searchParams.set("filename", options.filename);
    return url.toString();
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      await fs.mkdir(this.root, { recursive: true });
      await fs.access(this.root);
      return { ok: true, message: `Local storage at ${this.root} (development only)` };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }
}
