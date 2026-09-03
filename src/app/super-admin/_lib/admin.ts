import "server-only";
import { NextResponse } from "next/server";
import { getSessionContext, requireSuperAdmin, type SessionContext } from "@/lib/auth";
import { recordAudit, type AuditInput } from "@/lib/services/audit";
import { getClientIp } from "@/lib/utils/request";
import { fail, toUserMessage, type ActionResult } from "@/lib/utils/result";

export const PAGE_SIZE = 25;

export function parsePage(value: string | undefined): number {
  const n = Number(value ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** `?excludeDemo=0` includes demo workspace data; anything else excludes it (default on). */
export function excludeDemoFrom(value: string | undefined): boolean {
  return value !== "0";
}

export function enumParam<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/** Records an audit entry attributed to the signed-in super admin, including the hashed client IP. */
export async function adminAudit(admin: SessionContext, input: Omit<AuditInput, "actorUserId" | "actorEmail" | "ip">): Promise<void> {
  await recordAudit({ actorUserId: admin.user.id, actorEmail: admin.user.email, ip: await getClientIp(), ...input });
}

/** Wraps a server action body: enforces super admin access and converts thrown errors into `fail()`. Never call `redirect()` inside. */
export async function adminAction<T = undefined>(fn: (admin: SessionContext) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  let admin: SessionContext;
  try {
    admin = await requireSuperAdmin();
  } catch (error) {
    return fail(toUserMessage(error, "Super admin access required."));
  }
  try {
    return await fn(admin);
  } catch (error) {
    console.error("[super-admin] action failed", error);
    return fail(toUserMessage(error));
  }
}

/** Route-handler guard: returns the session or a JSON error response. */
export async function superAdminForRoute(): Promise<{ session: SessionContext; response?: undefined } | { session?: undefined; response: NextResponse }> {
  const session = await getSessionContext();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.platformRole !== "SUPER_ADMIN") return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}

export function jsonDownload(data: unknown, filename: string): NextResponse {
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}

export function requiredString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return !!value && UUID_RE.test(value);
}

/** Shows only the last six characters of an external identifier (e.g. Stripe ids). */
export function maskId(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length <= 6 ? value : `…${value.slice(-6)}`;
}

/** Splits a textarea value into trimmed, non-empty lines. */
export function linesToArray(text: string | null | undefined): string[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Builds a query string from the given params, dropping empty values and the page. */
export function exportQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
  return sp.toString();
}
