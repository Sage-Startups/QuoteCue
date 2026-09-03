export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectHead {
  sizeBytes: number;
  contentType: string | null;
}

export interface StorageProvider {
  readonly name: "railway" | "s3" | "local" | "memory";
  readonly bucket: string;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<{ body: Buffer; contentType: string | null } | null>;
  headObject(key: string): Promise<ObjectHead | null>;
  deleteObject(key: string): Promise<void>;
  createPresignedUpload(key: string, contentType: string, expiresInSeconds: number): Promise<PresignedUpload>;
  createPresignedDownload(key: string, expiresInSeconds: number, options?: { filename?: string; contentType?: string }): Promise<string>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
