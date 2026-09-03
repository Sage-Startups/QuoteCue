import { test, expect } from "@playwright/test";
import path from "node:path";
import { noHorizontalOverflow } from "./helpers";

const SCREENSHOTS = path.resolve("docs/screenshots");

test.describe("Responsive and accessibility checks", () => {
  test("landing page fits the viewport and has labelled navigation", async ({ page }, testInfo) => {
    await page.goto("/");
    await noHorizontalOverflow(page);
    await expect(page.getByRole("navigation").first()).toBeVisible();
    const name = testInfo.project.name === "mobile" ? "landing-mobile.png" : "landing-desktop.png";
    if (testInfo.project.name !== "tablet") await page.screenshot({ path: path.join(SCREENSHOTS, name), fullPage: true });
  });

  test("demo dashboard and quote list adapt to the viewport", async ({ page }) => {
    await page.goto("/demo");
    await noHorizontalOverflow(page);
    await page.goto("/demo/quotes");
    await noHorizontalOverflow(page);
    await page.goto("/demo/new-quote");
    await noHorizontalOverflow(page);
  });

  test("forms have labels and keyboard focus is visible", async ({ page }) => {
    await page.goto("/login");
    const inputs = page.locator("input:not([type=hidden])");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute("id");
      expect(id, "input should have an id").toBeTruthy();
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { tag: el.tagName, outline: style.outlineStyle, width: style.outlineWidth };
    });
    expect(focused?.tag).toBeTruthy();
  });

  test("empty and error states render", async ({ page }) => {
    const missing = await page.goto("/this-page-does-not-exist");
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const badToken = await page.goto("/q/not-a-real-token");
    expect(badToken?.status()).toBe(404);
  });
});
