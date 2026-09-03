import { test, expect } from "@playwright/test";
import { registerAndVerify, completeOnboarding, noHorizontalOverflow } from "./helpers";

test.describe("Mobile quote creation", () => {
  test("creates a quote from a phone-sized viewport", async ({ page }) => {
    await registerAndVerify(page, "Mobile Trader");
    await completeOnboarding(page, "Mobile Sparks");
    await page.goto("/app");
    await noHorizontalOverflow(page);
    await page.getByRole("link", { name: "New", exact: true }).click();
    await page.waitForURL(/\/edit\?step=1/);
    await noHorizontalOverflow(page);
    await page.getByRole("button", { name: "Create a new customer" }).click();
    await page.getByLabel("Contact name").fill("Priya Nair");
    await page.getByRole("button", { name: "Save customer" }).click();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.waitForURL(/step=2/);
    await noHorizontalOverflow(page);
    await expect(page.getByRole("button", { name: "Record voice note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
    await page.getByLabel("Enquiry").fill("Bathroom extractor fan needed, condensation problem.");
    await page.getByRole("button", { name: "Save and analyse" }).click();
    await page.waitForURL(/step=3/);
    await page.getByRole("button", { name: "Analyse with AI" }).click();
    await expect(page.getByRole("heading", { name: "Suggested work" })).toBeVisible({ timeout: 30_000 });
    await noHorizontalOverflow(page);
    await page.getByRole("button", { name: /Add selected items/ }).click();
    await page.waitForURL(/step=4/);
    await noHorizontalOverflow(page);
  });
});
