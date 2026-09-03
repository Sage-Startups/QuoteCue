import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToMinor } from "@/lib/utils/money";
import { resolveDateRange } from "@/lib/utils/dates";
import { parseCsv, toCsv } from "@/lib/utils/csv";
import { safeRedirectPath } from "@/lib/utils/redirect";
import { hashToken, generateSecureToken, safeEqual } from "@/lib/utils/tokens";
import { parseMarkdown, isSafeHref } from "@/lib/utils/safe-markdown";
import { findUnsupportedVariables, substituteVariables, renderEmailHtml } from "@/lib/email/render";
import { loadEnv } from "@/lib/env";

describe("money", () => {
  it("formats minor units per currency", () => {
    expect(formatMoney(123456, "GBP")).toBe("£1,234.56");
    expect(formatMoney(5, "USD")).toBe("$0.05");
  });
  it("parses human input to minor units", () => {
    expect(parseMoneyToMinor("1,250.50", "GBP")).toBe(125050);
    expect(parseMoneyToMinor("£45", "GBP")).toBe(4500);
    expect(parseMoneyToMinor("", "GBP")).toBe(0);
  });
});

describe("date ranges", () => {
  it("resolves presets and previous periods", () => {
    const now = new Date("2026-09-02T12:00:00Z");
    const r = resolveDateRange("7d", null, null, now);
    expect(r.days).toBe(7);
    expect(r.from.toISOString()).toBe("2026-08-27T00:00:00.000Z");
    expect(r.previousTo.getTime()).toBeLessThan(r.from.getTime());
    const c = resolveDateRange("custom", "2026-01-01", "2026-01-31", now);
    expect(c.key).toBe("custom");
    expect(c.days).toBe(31);
  });
});

describe("csv", () => {
  it("round-trips rows and guards formula injection", () => {
    const csv = toCsv([{ name: "=SUM(A1)", price: "1,000" }]);
    expect(csv).toContain("'=SUM(A1)");
    const rows = parseCsv('name,unit_price\n"Install socket, double",95.00\n');
    expect(rows[0]?.name).toBe("Install socket, double");
    expect(rows[0]?.unit_price).toBe("95.00");
  });
});

describe("security helpers", () => {
  it("blocks open redirects", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/app");
    expect(safeRedirectPath("https://evil.com")).toBe("/app");
    expect(safeRedirectPath("/app/quotes")).toBe("/app/quotes");
  });
  it("hashes tokens consistently and compares safely", () => {
    const t = generateSecureToken();
    expect(t.length).toBeGreaterThan(30);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "b")).toBe(false);
  });
  it("only allows safe hrefs in markdown", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("https://example.com")).toBe(true);
    const blocks = parseMarkdown("# Title\n\nHello **world** [link](javascript:alert(1))\n\n- a\n- b");
    expect(blocks[0]?.type).toBe("heading");
    expect(JSON.stringify(blocks)).not.toContain("javascript:");
  });
});

describe("email templates", () => {
  it("detects unsupported variables and substitutes known ones", () => {
    expect(findUnsupportedVariables("Hi {{name}} {{evil}}", ["name"])).toEqual(["evil"]);
    expect(substituteVariables("Hi {{name}}", { name: "Dave" })).toBe("Hi Dave");
    const html = renderEmailHtml("# Hello\n\n<script>alert(1)</script>\n\n[Go]({{url}})", { productName: "Q", primaryColor: "#000000", accentColor: "#ffffff", footerText: "f", appUrl: "https://x.test" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});

describe("environment validation", () => {
  const baseEnv = { DATABASE_URL: "postgresql://x", BETTER_AUTH_SECRET: "0123456789012345678901234567890123456789" };
  it("uses mocks in development when credentials are missing", () => {
    const env = loadEnv({ ...baseEnv, NODE_ENV: "development" });
    expect(env.providers.ai).toBe("mock");
    expect(env.providers.email).toBe("preview");
    expect(env.providers.stripe).toBe("mock");
  });
  it("refuses to start in production with mock providers", () => {
    expect(() => loadEnv({ ...baseEnv, NODE_ENV: "production", APP_URL: "https://quotecue.example" })).toThrow(/Refusing to start/);
  });
  it("requires bucket variables for the railway provider", () => {
    expect(() => loadEnv({ ...baseEnv, NODE_ENV: "development", STORAGE_PROVIDER: "railway" })).toThrow(/STORAGE_BUCKET/);
  });
});

describe("safe markdown inline parsing", () => {
  it("keeps bare URLs intact even when the token contains underscores", () => {
    const blocks = parseMarkdown("Open your quote: https://example.com/q/d5xBsM_-A0-Bb74G_fuG3F5mJlw today.");
    const paragraph = blocks[0];
    expect(paragraph?.type).toBe("paragraph");
    const link = paragraph?.type === "paragraph" ? paragraph.children.find((n) => n.type === "link") : undefined;
    expect(link?.type === "link" && link.href).toBe("https://example.com/q/d5xBsM_-A0-Bb74G_fuG3F5mJlw");
    expect(JSON.stringify(blocks)).not.toContain('"em"');
  });

  it("only treats underscores as emphasis at word boundaries", () => {
    const html = renderEmailHtml("snake_case_word stays, _this_ is emphasised and *so* is this.", { productName: "QuoteCue", primaryColor: "#000000", accentColor: "#000000", footerText: "", appUrl: "http://localhost:3000" });
    expect(html).toContain("snake_case_word");
    expect(html).toContain("<em>this</em>");
    expect(html).toContain("<em>so</em>");
  });
});
