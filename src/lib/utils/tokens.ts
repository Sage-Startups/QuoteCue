import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

/** Generates a URL-safe cryptographically secure token. */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hash of a token; only the hash is stored in the database. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function newId(): string {
  return randomUUID();
}

/** Hashes an IP address with a static salt so raw IPs are never stored. */
export function hashIp(ip: string | null | undefined, salt = "quotecue-ip"): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function randomFileName(extension: string): string {
  return `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}.${extension.replace(/^\./, "")}`;
}
