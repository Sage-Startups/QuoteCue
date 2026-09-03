import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, computeExpired, isOpenForDecision } from "@/lib/quotes/status";

describe("quote status transitions", () => {
  it("allows the normal lifecycle", () => {
    expect(canTransition("DRAFT", "READY")).toBe(true);
    expect(canTransition("READY", "SENT")).toBe(true);
    expect(canTransition("SENT", "VIEWED")).toBe(true);
    expect(canTransition("VIEWED", "ACCEPTED")).toBe(true);
    expect(canTransition("SENT", "EXPIRED")).toBe(true);
  });
  it("never lets an accepted quote be re-sent or declined", () => {
    expect(canTransition("ACCEPTED", "SENT")).toBe(false);
    expect(canTransition("ACCEPTED", "DECLINED")).toBe(false);
    expect(canTransition("ACCEPTED", "DRAFT")).toBe(false);
    expect(() => assertTransition("ACCEPTED", "SENT")).toThrow();
  });
  it("computes expiry from dates", () => {
    const now = new Date("2026-09-02T10:00:00Z");
    expect(computeExpired("SENT", new Date("2026-09-01T00:00:00Z"), now)).toBe(true);
    expect(computeExpired("SENT", new Date("2026-09-03T00:00:00Z"), now)).toBe(false);
    expect(computeExpired("ACCEPTED", new Date("2026-09-01T00:00:00Z"), now)).toBe(false);
    expect(isOpenForDecision("VIEWED", new Date("2026-09-03T00:00:00Z"), now)).toBe(true);
    expect(isOpenForDecision("VIEWED", new Date("2026-09-01T00:00:00Z"), now)).toBe(false);
  });
});
