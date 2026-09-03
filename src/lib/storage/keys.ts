import { randomFileName } from "@/lib/utils/tokens";
import type { UploadPurpose } from "@/generated/prisma/enums";

const PURPOSE_PREFIX: Record<UploadPurpose, string> = {
  LOGO: "logos",
  QUOTE_IMAGE: "quotes/images",
  QUOTE_AUDIO: "quotes/audio",
  QUOTE_DOCUMENT: "quotes/documents",
  QUOTE_PDF: "quotes/pdf",
  SITE_ASSET: "site",
  EXPORT: "exports",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
};

export function extensionForMime(mime: string): string | null {
  return EXTENSION_BY_MIME[mime.toLowerCase()] ?? null;
}

/**
 * Builds a safe, random object key. Keys never include user-supplied names so
 * path traversal and collisions are impossible.
 */
export function buildObjectKey(purpose: UploadPurpose, scopeId: string, mime: string): string {
  const ext = extensionForMime(mime) ?? "bin";
  const safeScope = scopeId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || "shared";
  return `${PURPOSE_PREFIX[purpose]}/${safeScope}/${randomFileName(ext)}`;
}

export function isSafeObjectKey(key: string): boolean {
  return /^[a-z0-9/_.-]+$/i.test(key) && !key.includes("..") && !key.startsWith("/");
}
