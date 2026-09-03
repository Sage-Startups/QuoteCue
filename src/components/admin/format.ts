/** Pure formatting helpers shared by super-admin pages and client components. */

export function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Formats micro-dollars (1e-6 USD) as a US dollar amount. */
export function formatUsdMicros(micros: number, options: { precise?: boolean } = {}): string {
  const dollars = micros / 1_000_000;
  const digits = options.precise || (dollars > 0 && dollars < 0.1) ? 4 : 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: digits }).format(dollars);
}

export function formatUsdMinor(minor: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
}

export function percent(numerator: number, denominator: number, digits = 0): string {
  if (denominator <= 0) return "0%";
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

export function hoursSince(date: Date | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  return (now.getTime() - date.getTime()) / 3_600_000;
}

export function minorToDecimalString(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function decimalToMinor(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Current time helper for server components (keeps render bodies free of direct Date calls). */
export function currentTime(): Date {
  return new Date();
}

export function timeAgo(ms: number): Date {
  return new Date(currentTime().getTime() - ms);
}
