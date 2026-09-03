import { createHmac } from "node:crypto";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/utils/tokens";

/**
 * HMAC-signed URLs used by the local and in-memory storage providers so that
 * development uploads follow the same presigned flow as the Railway bucket.
 */
export function signLocalUrl(action: "upload" | "download", key: string, expiresAt: number, contentType = ""): string {
  const secret = getEnv().BETTER_AUTH_SECRET;
  return createHmac("sha256", secret).update(`${action}\n${key}\n${expiresAt}\n${contentType}`).digest("base64url");
}

export function verifyLocalUrl(action: "upload" | "download", key: string, expiresAt: number, signature: string, contentType = ""): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = signLocalUrl(action, key, expiresAt, contentType);
  return safeEqual(expected, signature);
}
