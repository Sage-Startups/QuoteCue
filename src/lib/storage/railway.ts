import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv, missingStorageCredentials } from "@/lib/env";
import type { ObjectHead, PresignedUpload, StorageProvider } from "./types";

/**
 * Railway Storage Bucket provider using the S3-compatible API. All objects are
 * private; access is only ever granted through short-lived presigned URLs or
 * authenticated proxy routes.
 */
export class RailwayBucketStorage implements StorageProvider {
  readonly name: "railway" | "s3";
  readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    const env = getEnv();
    const missing = missingStorageCredentials(env);
    if (missing.length > 0) {
      throw new Error(
        `Object storage is not configured: STORAGE_PROVIDER=${env.STORAGE_PROVIDER} still needs ${missing.join(", ")}. ` +
          `Set them on the service (values come from your bucket provider) and redeploy; until then uploads and file downloads are unavailable.`,
      );
    }
    this.name = env.STORAGE_PROVIDER === "s3" ? "s3" : "railway";
    this.bucket = env.STORAGE_BUCKET!;
    this.client = new S3Client({
      region: env.STORAGE_REGION!,
      endpoint: env.STORAGE_ENDPOINT!,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE ?? true,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
      },
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string | null } | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return null;
      return { body: Buffer.from(bytes), contentType: res.ContentType ?? null };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async createPresignedUpload(key: string, contentType: string, expiresInSeconds: number): Promise<PresignedUpload> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async createPresignedDownload(key: string, expiresInSeconds: number, options?: { filename?: string; contentType?: string }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options?.filename ? `attachment; filename="${options.filename.replace(/[^\w.-]/g, "_")}"` : undefined,
      ResponseContentType: options?.contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true, message: `Bucket "${this.bucket}" reachable` };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}
