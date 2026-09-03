import type { Currency } from "@/generated/prisma/enums";

export const SUPPORTED_CURRENCIES: Currency[] = ["USD", "GBP", "EUR", "CAD", "AUD", "NZD"];

export const CURRENCY_META: Record<Currency, { symbol: string; locale: string; name: string; minorUnits: number }> = {
  USD: { symbol: "$", locale: "en-US", name: "US Dollar", minorUnits: 100 },
  GBP: { symbol: "£", locale: "en-GB", name: "Pound Sterling", minorUnits: 100 },
  EUR: { symbol: "€", locale: "de-DE", name: "Euro", minorUnits: 100 },
  CAD: { symbol: "CA$", locale: "en-CA", name: "Canadian Dollar", minorUnits: 100 },
  AUD: { symbol: "A$", locale: "en-AU", name: "Australian Dollar", minorUnits: 100 },
  NZD: { symbol: "NZ$", locale: "en-NZ", name: "New Zealand Dollar", minorUnits: 100 },
};

export function formatMoney(minor: number, currency: Currency, locale?: string): string {
  const meta = CURRENCY_META[currency];
  const amount = minor / meta.minorUnits;
  return new Intl.NumberFormat(locale ?? meta.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyCompact(minor: number, currency: Currency, locale?: string): string {
  const meta = CURRENCY_META[currency];
  const amount = minor / meta.minorUnits;
  return new Intl.NumberFormat(locale ?? meta.locale, {
    style: "currency",
    currency,
    notation: amount >= 10000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 10000 ? 1 : 2,
  }).format(amount);
}

/** Parses a human-entered amount such as "1,250.50" into integer minor units. */
export function parseMoneyToMinor(input: string | number, currency: Currency = "GBP"): number {
  const meta = CURRENCY_META[currency];
  if (typeof input === "number") return Math.round(input * meta.minorUnits);
  const cleaned = input.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (cleaned.trim() === "" || cleaned === "-") return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new Error(`Invalid amount: ${input}`);
  return Math.round(value * meta.minorUnits);
}

export function minorToMajor(minor: number, currency: Currency = "GBP"): number {
  return minor / CURRENCY_META[currency].minorUnits;
}

export function majorToMinor(major: number, currency: Currency = "GBP"): number {
  return Math.round(major * CURRENCY_META[currency].minorUnits);
}

export function formatPercentFromBps(bps: number): string {
  return `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}
