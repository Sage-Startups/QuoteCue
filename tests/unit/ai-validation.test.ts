import { describe, expect, it } from "vitest";
import { enquiryAnalysisSchema, quoteWordingSchema } from "@/lib/ai/schemas";
import { buildMockFixture } from "@/lib/ai/mock-fixtures";
import { estimateCostMicros } from "@/lib/ai/runner";

describe("AI schemas", () => {
  it("accepts the mock analysis fixture", () => {
    const fixture = buildMockFixture("enquiry_analysis", "need 2 double sockets and the hall light changing, fuse box in garage", { catalogue: [{ id: "a", name: "Install double socket outlet" }], photoCount: 1 });
    const parsed = enquiryAnalysisSchema.safeParse(fixture);
    if (!parsed.success) console.log("ISSUES", JSON.stringify(parsed.error.issues));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.suggestedWork.length).toBeGreaterThan(0);
      expect(parsed.data.photoObservations[0]?.caveat).toContain("cannot confirm");
      expect(parsed.data.suggestedWork.find((w) => w.description.includes("socket"))?.quantity).toBe(2);
    }
  });
  it("rejects invented prices or invalid shapes", () => {
    const parsed = enquiryAnalysisSchema.safeParse({ jobSummary: "x", suggestedWork: [{ description: "Work", price: 100 }] });
    expect(parsed.success).toBe(false);
  });
  it("accepts the mock wording fixture", () => {
    const fixture = buildMockFixture("quote_wording", "electrical sockets", { businessName: "Northstar", customerName: "Dave", lineItems: "Install socket | 2 | ITEM | LABOUR" });
    expect(quoteWordingSchema.safeParse(fixture).success).toBe(true);
  });
  it("estimates cost from token usage and rates", () => {
    const micros = estimateCostMicros({ inputTokens: 1_000_000, outputTokens: 500_000 }, { inputCostCentsPerMillion: 25, outputCostCentsPerMillion: 200, transcriptionCostCentsPerMinute: 0.3 });
    expect(micros).toBe(1_250_000); // $0.25 + $1.00 = $1.25
  });
});
