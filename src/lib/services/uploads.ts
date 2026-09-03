import sharp from "sharp";
import type { UploadPurpose } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getStorage, buildObjectKey, extensionForMime } from "@/lib/storage";
import { AppError, NotFoundError } from "@/lib/utils/result";

const PRESIGN_TTL_SECONDS = 300;
const DOWNLOAD_TTL_SECONDS = 300;

export interface UploadPolicy {
  maxBytes: number;
  allowedTypes: string[];
}

export async function uploadPolicyFor(purpose: UploadPurpose): Promise<UploadPolicy> {
  const s = await getSiteSettings();
  switch (purpose) {
    case "LOGO":
      return { maxBytes: s["app.maxLogoMb"] * 1024 * 1024, allowedTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] };
    case "QUOTE_IMAGE":
      return { maxBytes: s["app.maxImageMb"] * 1024 * 1024, allowedTypes: s["app.allowedImageTypes"] };
    case "QUOTE_AUDIO":
      return { maxBytes: s["app.maxAudioMb"] * 1024 * 1024, allowedTypes: s["app.allowedAudioTypes"] };
    case "QUOTE_DOCUMENT":
      return { maxBytes: s["app.maxDocumentMb"] * 1024 * 1024, allowedTypes: s["app.allowedDocumentTypes"] };
    case "SITE_ASSET":
      return { maxBytes: 5 * 1024 * 1024, allowedTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon"] };
    default:
      return { maxBytes: 20 * 1024 * 1024, allowedTypes: ["application/pdf", "text/csv", "application/json"] };
  }
}

function extensionMatchesMime(filename: string, mime: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const expected = extensionForMime(mime);
  if (!expected) return false;
  const aliases: Record<string, string[]> = { jpg: ["jpg", "jpeg"], m4a: ["m4a", "mp4", "aac"], mp3: ["mp3", "mpeg"], webm: ["webm"], txt: ["txt", "text"], ico: ["ico"] };
  return (aliases[expected] ?? [expected]).includes(ext);
}

export interface PresignInput {
  workspaceId: string | null;
  userId: string;
  purpose: UploadPurpose;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  quoteId?: string | null;
}

/** Step 1-4 of the upload flow: validate, create a pending record, return a presigned URL. */
export async function createPresignedUpload(input: PresignInput) {
  const policy = await uploadPolicyFor(input.purpose);
  const mime = input.mimeType.toLowerCase();
  if (!policy.allowedTypes.includes(mime)) {
    throw new AppError(`File type ${mime || "unknown"} is not accepted here. Accepted: ${policy.allowedTypes.map((t) => t.split("/")[1]).join(", ")}.`);
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) throw new AppError("File is empty.");
  if (input.sizeBytes > policy.maxBytes) throw new AppError(`File is too large. Maximum size is ${Math.round(policy.maxBytes / 1024 / 1024)} MB.`);
  if (!extensionMatchesMime(input.filename, mime)) throw new AppError("The file extension does not match its type.");
  if (input.quoteId && input.workspaceId) {
    const quote = await prisma.quote.findFirst({ where: { id: input.quoteId, workspaceId: input.workspaceId }, select: { id: true } });
    if (!quote) throw new NotFoundError("Quote not found");
  }
  const key = buildObjectKey(input.purpose, input.workspaceId ?? input.userId, mime);
  const storage = getStorage();
  const presigned = await storage.createPresignedUpload(key, mime, PRESIGN_TTL_SECONDS);
  const upload = await prisma.upload.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      purpose: input.purpose,
      objectKey: key,
      originalFilename: input.filename.slice(0, 200),
      mimeType: mime,
      expectedBytes: input.sizeBytes,
      quoteId: input.quoteId ?? null,
      expiresAt: presigned.expiresAt,
    },
    select: { id: true },
  });
  return { uploadId: upload.id, url: presigned.url, method: presigned.method, headers: presigned.headers, expiresAt: presigned.expiresAt };
}

/**
 * Steps 6-8: verify the object exists in storage with the expected size, run
 * image processing (resize, compress, strip metadata) and mark it complete.
 */
export async function finalizeUpload(input: { uploadId: string; workspaceId: string | null; userId: string }) {
  const upload = await prisma.upload.findFirst({ where: { id: input.uploadId, userId: input.userId, workspaceId: input.workspaceId } });
  if (!upload) throw new NotFoundError("Upload not found");
  if (upload.status === "COMPLETED" && upload.storedObjectId) {
    const obj = await prisma.storedObject.findUniqueOrThrow({ where: { id: upload.storedObjectId } });
    return { storedObject: obj, upload };
  }
  if (upload.status !== "PENDING") throw new AppError("This upload can no longer be completed. Please upload the file again.");
  const storage = getStorage();
  const head = await storage.headObject(upload.objectKey);
  if (!head) {
    await prisma.upload.update({ where: { id: upload.id }, data: { status: "FAILED", error: "Object not found in storage" } });
    throw new AppError("The file did not reach storage. Please try again.");
  }
  const policy = await uploadPolicyFor(upload.purpose);
  if (head.sizeBytes > policy.maxBytes || head.sizeBytes > upload.expectedBytes * 1.05 + 1024) {
    await storage.deleteObject(upload.objectKey);
    await prisma.upload.update({ where: { id: upload.id }, data: { status: "FAILED", error: "Object exceeded the expected size" } });
    throw new AppError("The uploaded file was larger than expected and has been removed.");
  }

  let width: number | null = null;
  let height: number | null = null;
  let finalMime = upload.mimeType;
  let finalSize = head.sizeBytes;
  let checksum: string | null = null;

  if (upload.mimeType.startsWith("image/") && upload.mimeType !== "image/svg+xml") {
    const obj = await storage.getObject(upload.objectKey);
    if (obj) {
      try {
        const processed = await processImage(obj.body, upload.purpose);
        await storage.putObject(upload.objectKey, processed.buffer, processed.mimeType);
        width = processed.width;
        height = processed.height;
        finalMime = processed.mimeType;
        finalSize = processed.buffer.length;
        checksum = processed.checksum;
      } catch (error) {
        await storage.deleteObject(upload.objectKey);
        await prisma.upload.update({ where: { id: upload.id }, data: { status: "FAILED", error: `Image processing failed: ${(error as Error).message}` } });
        throw new AppError("That image could not be processed. Please upload a JPEG, PNG or WebP file.");
      }
    }
  }

  const storedObject = await prisma.$transaction(async (tx) => {
    const obj = await tx.storedObject.create({
      data: {
        workspaceId: upload.workspaceId,
        key: upload.objectKey,
        bucket: storage.bucket,
        purpose: upload.purpose,
        mimeType: finalMime,
        sizeBytes: finalSize,
        originalFilename: upload.originalFilename,
        width,
        height,
        checksum,
      },
    });
    await tx.upload.update({ where: { id: upload.id }, data: { status: "COMPLETED", actualBytes: finalSize, completedAt: new Date(), storedObjectId: obj.id } });
    return obj;
  });
  return { storedObject, upload };
}

async function processImage(buffer: Buffer, purpose: UploadPurpose) {
  const maxDimension = purpose === "LOGO" ? 800 : purpose === "SITE_ASSET" ? 1600 : 2000;
  const image = sharp(buffer, { failOn: "error" }).rotate();
  const meta = await image.metadata();
  const keepPng = purpose === "LOGO" || purpose === "SITE_ASSET";
  const pipeline = image.resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true });
  // Metadata (EXIF, GPS) is stripped by default because withMetadata() is not called.
  const output = keepPng && (meta.hasAlpha || meta.format === "png") ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true }) : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const { createHash } = await import("node:crypto");
  return {
    buffer: output.data,
    width: output.info.width,
    height: output.info.height,
    mimeType: output.info.format === "png" ? "image/png" : "image/jpeg",
    checksum: createHash("sha256").update(output.data).digest("hex"),
  };
}

/** Returns a short-lived download URL after the caller has verified authorization. */
export async function signedDownloadUrl(storedObjectId: string, options?: { filename?: string; workspaceId?: string | null }): Promise<string> {
  const obj = await prisma.storedObject.findFirst({ where: { id: storedObjectId, deletedAt: null, workspaceId: options?.workspaceId === undefined ? undefined : options.workspaceId } });
  if (!obj) throw new NotFoundError("File not found");
  return getStorage().createPresignedDownload(obj.key, DOWNLOAD_TTL_SECONDS, { filename: options?.filename ?? obj.originalFilename ?? undefined, contentType: obj.mimeType });
}

export async function readStoredObject(storedObjectId: string): Promise<{ body: Buffer; mimeType: string; filename: string | null } | null> {
  const obj = await prisma.storedObject.findFirst({ where: { id: storedObjectId, deletedAt: null } });
  if (!obj) return null;
  const data = await getStorage().getObject(obj.key);
  if (!data) return null;
  return { body: data.body, mimeType: obj.mimeType, filename: obj.originalFilename };
}

export async function storeGeneratedObject(input: { workspaceId: string | null; purpose: UploadPurpose; body: Buffer; mimeType: string; filename: string }) {
  const key = buildObjectKey(input.purpose, input.workspaceId ?? "system", input.mimeType);
  const storage = getStorage();
  await storage.putObject(key, input.body, input.mimeType);
  return prisma.storedObject.create({
    data: { workspaceId: input.workspaceId, key, bucket: storage.bucket, purpose: input.purpose, mimeType: input.mimeType, sizeBytes: input.body.length, originalFilename: input.filename },
  });
}

export async function deleteStoredObject(storedObjectId: string, workspaceId?: string | null): Promise<void> {
  const obj = await prisma.storedObject.findFirst({ where: { id: storedObjectId, workspaceId: workspaceId === undefined ? undefined : workspaceId } });
  if (!obj) return;
  await getStorage().deleteObject(obj.key).catch(() => undefined);
  await prisma.storedObject.update({ where: { id: obj.id }, data: { deletedAt: new Date() } });
}

export function imageToDataUrl(body: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${body.toString("base64")}`;
}
