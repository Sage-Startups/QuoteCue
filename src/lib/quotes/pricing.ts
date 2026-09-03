import Decimal from "decimal.js";
import type { DiscountType, PricingMode, TaxTreatment } from "@/generated/prisma/enums";

/**
 * Deterministic quote arithmetic. All inputs are integer minor units except
 * quantities (decimal strings/numbers) and percentages (basis points).
 * AI is never involved in these calculations.
 */

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export interface PricingLineInput {
  id?: string;
  quantity: Decimal.Value;
  unitPriceMinor: number;
  discountType: DiscountType;
  /** Fixed: minor units. Percent: basis points (e.g. 1000 = 10%). */
  discountValue: number;
  taxTreatment: TaxTreatment;
  internalCostMinor?: number;
  isOptional?: boolean;
}

export interface PricingInput {
  lines: PricingLineInput[];
  pricingMode: PricingMode;
  taxRateBps: number;
  discountType: DiscountType;
  discountValue: number;
  callOutFeeMinor: number;
}

export interface PricedLine {
  id?: string;
  lineSubtotalMinor: number;
  lineDiscountMinor: number;
  lineTotalMinor: number;
  taxableMinor: number;
  internalCostMinor: number;
  isOptional: boolean;
}

export interface PricingResult {
  lines: PricedLine[];
  /** Sum of line totals (after line discounts) plus the call-out fee. */
  subtotalMinor: number;
  /** Quote-level discount applied to the subtotal. */
  discountMinor: number;
  /** Net amount after discount, before tax (tax-exclusive) or including tax (inclusive). */
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  internalCostMinor: number;
  marginMinor: number;
  marginPercent: number;
  taxableBaseMinor: number;
  callOutFeeMinor: number;
}

function toMinor(value: Decimal): number {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function priceLine(line: PricingLineInput): PricedLine {
  const quantity = new Decimal(line.quantity || 0);
  if (quantity.isNegative()) throw new Error("Quantity cannot be negative");
  if (line.unitPriceMinor < 0) throw new Error("Unit price cannot be negative");
  const gross = quantity.mul(line.unitPriceMinor);
  const subtotal = toMinor(gross);
  let discount = 0;
  if (line.discountType === "FIXED") {
    discount = Math.min(subtotal, Math.max(0, Math.round(line.discountValue)));
  } else if (line.discountType === "PERCENT") {
    const bps = Math.min(10000, Math.max(0, line.discountValue));
    discount = toMinor(new Decimal(subtotal).mul(bps).div(10000));
  }
  const total = subtotal - discount;
  const internalCost = toMinor(quantity.mul(line.internalCostMinor ?? 0));
  const isOptional = line.isOptional ?? false;
  return {
    id: line.id,
    lineSubtotalMinor: subtotal,
    lineDiscountMinor: discount,
    lineTotalMinor: total,
    taxableMinor: line.taxTreatment === "TAXABLE" ? total : 0,
    internalCostMinor: internalCost,
    isOptional,
  };
}

export function calculateQuote(input: PricingInput): PricingResult {
  const lines = input.lines.map(priceLine);
  const includedLines = lines.filter((l) => !l.isOptional);
  const linesTotal = includedLines.reduce((acc, l) => acc + l.lineTotalMinor, 0);
  const callOut = Math.max(0, Math.round(input.callOutFeeMinor || 0));
  const subtotal = linesTotal + callOut;

  let discount = 0;
  if (input.discountType === "FIXED") {
    discount = Math.min(subtotal, Math.max(0, Math.round(input.discountValue)));
  } else if (input.discountType === "PERCENT") {
    const bps = Math.min(10000, Math.max(0, input.discountValue));
    discount = toMinor(new Decimal(subtotal).mul(bps).div(10000));
  }

  const taxableLines = includedLines.reduce((acc, l) => acc + l.taxableMinor, 0) + callOut;
  // Spread the quote-level discount proportionally across the taxable portion.
  const discountShare = subtotal > 0 ? new Decimal(discount).div(subtotal) : new Decimal(0);
  const taxableBase = toMinor(new Decimal(taxableLines).mul(new Decimal(1).minus(discountShare)));
  const net = subtotal - discount;

  let tax = 0;
  let total = net;
  const rate = new Decimal(Math.max(0, input.taxRateBps)).div(10000);
  if (input.pricingMode === "TAX_EXCLUSIVE" && rate.gt(0)) {
    tax = toMinor(new Decimal(taxableBase).mul(rate));
    total = net + tax;
  } else if (input.pricingMode === "TAX_INCLUSIVE" && rate.gt(0)) {
    // Prices already include tax: extract the tax portion for display.
    tax = toMinor(new Decimal(taxableBase).minus(new Decimal(taxableBase).div(rate.plus(1))));
    total = net;
  }

  const internalCost = includedLines.reduce((acc, l) => acc + l.internalCostMinor, 0);
  const margin = net - internalCost;
  const marginPercent = net > 0 ? new Decimal(margin).div(net).mul(100).toDecimalPlaces(1).toNumber() : 0;

  return {
    lines,
    subtotalMinor: subtotal,
    discountMinor: discount,
    netMinor: net,
    taxMinor: tax,
    totalMinor: total,
    internalCostMinor: internalCost,
    marginMinor: margin,
    marginPercent,
    taxableBaseMinor: taxableBase,
    callOutFeeMinor: callOut,
  };
}

export function parseQuantity(input: string | number | null | undefined): string {
  if (input === null || input === undefined || input === "") return "1";
  const d = new Decimal(typeof input === "string" ? input.replace(/,/g, "") : input);
  if (!d.isFinite() || d.isNegative()) throw new Error("Quantity must be a non-negative number");
  return d.toDecimalPlaces(3).toString();
}
