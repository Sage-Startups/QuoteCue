import { describe, expect, it } from "vitest";
import { calculateQuote, priceLine, parseQuantity } from "@/lib/quotes/pricing";

const base = { discountType: "NONE" as const, discountValue: 0, taxTreatment: "TAXABLE" as const };

describe("priceLine", () => {
  it("multiplies quantity by unit price with half-up rounding", () => {
    expect(priceLine({ ...base, quantity: "2.5", unitPriceMinor: 333 }).lineTotalMinor).toBe(833);
    expect(priceLine({ ...base, quantity: "3", unitPriceMinor: 4500 }).lineTotalMinor).toBe(13500);
  });
  it("applies percentage line discounts in basis points", () => {
    const line = priceLine({ ...base, quantity: 1, unitPriceMinor: 10000, discountType: "PERCENT", discountValue: 1250 });
    expect(line.lineDiscountMinor).toBe(1250);
    expect(line.lineTotalMinor).toBe(8750);
  });
  it("caps fixed discounts at the line subtotal", () => {
    const line = priceLine({ ...base, quantity: 1, unitPriceMinor: 500, discountType: "FIXED", discountValue: 900 });
    expect(line.lineTotalMinor).toBe(0);
  });
  it("rejects negative quantities and prices", () => {
    expect(() => priceLine({ ...base, quantity: -1, unitPriceMinor: 100 })).toThrow();
    expect(() => priceLine({ ...base, quantity: 1, unitPriceMinor: -100 })).toThrow();
  });
});

describe("calculateQuote", () => {
  const lines = [
    { ...base, quantity: 2, unitPriceMinor: 9500, internalCostMinor: 3500 },
    { ...base, quantity: 1, unitPriceMinor: 4500, internalCostMinor: 500, taxTreatment: "EXEMPT" as const },
  ];
  it("computes subtotal, tax-exclusive tax and total", () => {
    const r = calculateQuote({ lines, pricingMode: "TAX_EXCLUSIVE", taxRateBps: 2000, discountType: "NONE", discountValue: 0, callOutFeeMinor: 0 });
    expect(r.subtotalMinor).toBe(23500);
    expect(r.taxableBaseMinor).toBe(19000);
    expect(r.taxMinor).toBe(3800);
    expect(r.totalMinor).toBe(27300);
    expect(r.internalCostMinor).toBe(7500);
    expect(r.marginMinor).toBe(16000);
  });
  it("includes the call-out fee in the taxable subtotal", () => {
    const r = calculateQuote({ lines, pricingMode: "TAX_EXCLUSIVE", taxRateBps: 2000, discountType: "NONE", discountValue: 0, callOutFeeMinor: 4500 });
    expect(r.subtotalMinor).toBe(28000);
    expect(r.taxMinor).toBe(4700);
    expect(r.totalMinor).toBe(32700);
  });
  it("applies a percentage quote discount proportionally before tax", () => {
    const r = calculateQuote({ lines, pricingMode: "TAX_EXCLUSIVE", taxRateBps: 2000, discountType: "PERCENT", discountValue: 1000, callOutFeeMinor: 0 });
    expect(r.discountMinor).toBe(2350);
    expect(r.netMinor).toBe(21150);
    expect(r.taxableBaseMinor).toBe(17100);
    expect(r.taxMinor).toBe(3420);
    expect(r.totalMinor).toBe(24570);
  });
  it("applies a fixed quote discount", () => {
    const r = calculateQuote({ lines, pricingMode: "TAX_EXCLUSIVE", taxRateBps: 0, discountType: "FIXED", discountValue: 1000, callOutFeeMinor: 0 });
    expect(r.discountMinor).toBe(1000);
    expect(r.totalMinor).toBe(22500);
  });
  it("extracts the tax portion for tax-inclusive pricing", () => {
    const r = calculateQuote({ lines: [{ ...base, quantity: 1, unitPriceMinor: 12000 }], pricingMode: "TAX_INCLUSIVE", taxRateBps: 2000, discountType: "NONE", discountValue: 0, callOutFeeMinor: 0 });
    expect(r.totalMinor).toBe(12000);
    expect(r.taxMinor).toBe(2000);
  });
  it("ignores tax entirely in NO_TAX mode", () => {
    const r = calculateQuote({ lines, pricingMode: "NO_TAX", taxRateBps: 2000, discountType: "NONE", discountValue: 0, callOutFeeMinor: 0 });
    expect(r.taxMinor).toBe(0);
    expect(r.totalMinor).toBe(23500);
  });
  it("excludes optional lines from totals but keeps them priced", () => {
    const r = calculateQuote({ lines: [...lines, { ...base, quantity: 1, unitPriceMinor: 5000, isOptional: true }], pricingMode: "NO_TAX", taxRateBps: 0, discountType: "NONE", discountValue: 0, callOutFeeMinor: 0 });
    expect(r.totalMinor).toBe(23500);
    expect(r.lines[2]?.lineTotalMinor).toBe(5000);
  });
  it("rounds currency to whole minor units deterministically", () => {
    const r = calculateQuote({ lines: [{ ...base, quantity: "1.333", unitPriceMinor: 1001 }], pricingMode: "TAX_EXCLUSIVE", taxRateBps: 1750, discountType: "NONE", discountValue: 0, callOutFeeMinor: 0 });
    expect(r.subtotalMinor).toBe(1334);
    expect(r.taxMinor).toBe(233);
    expect(Number.isInteger(r.totalMinor)).toBe(true);
  });
});

describe("parseQuantity", () => {
  it("normalises quantities to three decimal places", () => {
    expect(parseQuantity("2,000.12345")).toBe("2000.123");
    expect(parseQuantity(undefined)).toBe("1");
    expect(() => parseQuantity("-3")).toThrow();
  });
});
