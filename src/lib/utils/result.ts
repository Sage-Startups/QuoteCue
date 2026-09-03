/** Standard shape returned by server actions so forms can render errors safely. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail<T = undefined>(error: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "AppError";
    this.status = options.status ?? 400;
    this.code = options.code ?? "APP_ERROR";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, { status: 404, code: "NOT_FOUND" });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(message, { status: 403, code: "FORBIDDEN" });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue") {
    super(message, { status: 401, code: "UNAUTHORIZED" });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please wait a moment and try again.") {
    super(message, { status: 429, code: "RATE_LIMITED" });
  }
}

export class EntitlementError extends AppError {
  constructor(message: string) {
    super(message, { status: 402, code: "ENTITLEMENT" });
  }
}

/** Converts unknown errors into a user-safe message without leaking internals. */
export function toUserMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && process.env.NODE_ENV !== "production") return error.message;
  return fallback;
}
