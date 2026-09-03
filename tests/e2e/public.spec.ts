import { test, expect } from "@playwright/test";
import { noHorizontalOverflow } from "./helpers";

test.describe("Public site and demo", () => {
  test("homepage renders and links to the live demo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Turn job enquiries into professional quotes");
    await page.getByRole("link", { name: "Explore the live demo" }).first().click();
    await page.waitForURL(/\/demo/);
    await expect(page.getByText("Interactive demo — sample data only")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Northstar Electrical Services");
  });

  test("demo quote creation walkthrough works with mock AI", async ({ page }) => {
    await page.goto("/demo/new-quote");
    await page.getByRole("button", { name: /Analyse with AI/ }).click();
    await expect(page.getByRole("heading", { name: "Suggested work" })).toBeVisible();
    await page.getByRole("button", { name: /Price the work/ }).click();
    await expect(page.getByRole("heading", { name: "Line items" })).toBeVisible();
    await page.getByRole("button", { name: /Generate wording and preview/ }).click();
    await expect(page.getByText("Your quote is ready")).toBeVisible();
    await expect(page.getByLabel(/Quote QC-/)).toBeVisible();
  });

  test("demo quotes list, detail and customer view", async ({ page }) => {
    await page.goto("/demo/quotes");
    const first = page.locator("table a").first();
    await first.click();
    await page.waitForURL(/\/demo\/quotes\//);
    await expect(page.getByRole("heading", { name: "Activity timeline" })).toBeVisible();
    await page.getByRole("link", { name: "See the customer view" }).click();
    await expect(page.getByText("This is what your customer sees")).toBeVisible();
  });

  test("marketing pages render without broken internal links", async ({ page, request }) => {
    for (const path of ["/features", "/how-it-works", "/pricing", "/templates", "/about", "/contact", "/faq", "/privacy", "/terms", "/cookies"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noHorizontalOverflow(page);
    }
    await page.goto("/");
    const hrefs = await page.locator("a[href^='/']").evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!))]);
    for (const href of hrefs.filter((h) => !h.startsWith("/api") && !h.includes("#"))) {
      const res = await request.get(href, { maxRedirects: 5 });
      expect(res.status(), `link ${href}`).toBeLessThan(400);
    }
  });

  test("health endpoint and SEO files", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();
    expect((await health.json()).database).toBe("ok");
    expect((await request.get("/robots.txt")).ok()).toBeTruthy();
    expect((await request.get("/sitemap.xml")).ok()).toBeTruthy();
  });
});
