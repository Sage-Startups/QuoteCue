export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDayUtc(b).getTime() - startOfDayUtc(a).getTime()) / 86_400_000);
}

export function formatDate(date: Date | string | null | undefined, locale = "en-GB", options?: Intl.DateTimeFormatOptions): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options ?? { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined, locale = "en-GB"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(diff / 60_000);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(minutes, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (abs < 86_400_000) return rtf.format(hours, "hour");
  const days = Math.round(diff / 86_400_000);
  if (abs < 30 * 86_400_000) return rtf.format(days, "day");
  const months = Math.round(diff / (30 * 86_400_000));
  return rtf.format(months, "month");
}

export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DateRangeKey = "7d" | "30d" | "90d" | "custom";

export function resolveDateRange(key: string | undefined, from?: string | null, to?: string | null, now = new Date()): {
  key: DateRangeKey;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  days: number;
} {
  const end = endOfDayUtc(now);
  let start: Date;
  let resolvedKey: DateRangeKey = "30d";
  let resolvedEnd = end;
  if (key === "custom" && from && to) {
    const f = parseDateInput(from);
    const t = parseDateInput(to);
    if (f && t && f <= t) {
      start = startOfDayUtc(f);
      resolvedEnd = endOfDayUtc(t);
      resolvedKey = "custom";
    } else {
      start = startOfDayUtc(addDays(now, -29));
    }
  } else if (key === "7d") {
    start = startOfDayUtc(addDays(now, -6));
    resolvedKey = "7d";
  } else if (key === "90d") {
    start = startOfDayUtc(addDays(now, -89));
    resolvedKey = "90d";
  } else {
    start = startOfDayUtc(addDays(now, -29));
  }
  const days = daysBetween(start, resolvedEnd) + 1;
  const previousTo = new Date(start.getTime() - 1);
  const previousFrom = startOfDayUtc(addDays(start, -days));
  return { key: resolvedKey, from: start, to: resolvedEnd, previousFrom, previousTo, days };
}
