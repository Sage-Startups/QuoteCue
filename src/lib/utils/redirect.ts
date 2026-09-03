/** Prevents open redirects: only same-origin relative paths are allowed. */
export function safeRedirectPath(input: string | null | undefined, fallback = "/app"): string {
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(trimmed)) return fallback;
  return trimmed;
}
