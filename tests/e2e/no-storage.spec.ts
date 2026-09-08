import { test, expect } from "@playwright/test";
import { registerAndVerify, completeOnboarding } from "./helpers";

/**
 * With no bucket configured the wizard must say so plainly instead of offering
 * upload controls that fail with "Something went wrong". Run this suite with
 * STORAGE_PROVIDER=railway and no bucket credentials.
 */
test("wizard explains that uploads are unavailable and offers no upload controls", async ({ page }) => {
  await registerAndVerify(page, "No Storage Trader");
  await completeOnboarding(page, "No Storage Ltd");
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Create a new customer" }).click();
  await page.getByLabel("Contact name").fill("Dana Ruiz");
  await page.getByRole("button", { name: "Save customer" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL(/step=2/);

  await expect(page.getByText("File uploads are unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record voice note" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Take photo" })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);

  // Typing an enquiry and running the analysis still works without storage.
  await page.getByLabel("Enquiry").fill("Two double sockets in the living room.");
  await page.getByRole("button", { name: "Save and analyse" }).click();
  await page.waitForURL(/step=3/);
  await page.getByRole("button", { name: "Analyse with AI" }).click();
  await expect(page.getByRole("heading", { name: "Suggested work" })).toBeVisible({ timeout: 60_000 });
});
