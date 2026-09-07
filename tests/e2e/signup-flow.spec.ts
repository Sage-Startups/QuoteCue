import { test, expect } from "@playwright/test";
import { uniqueEmail, withDb, PASSWORD, completeOnboarding } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Sign-up without email verification", () => {
  test("free plan: sign-up goes straight into onboarding and the dashboard", async ({ page }) => {
    await withDb((db) => db.query(`DELETE FROM "RateLimitBucket" WHERE "key" LIKE 'registration:%'`));
    const email = uniqueEmail();
    await page.goto("/signup");
    await expect(page.getByRole("group", { name: "Billing interval" })).toBeVisible();
    await page.getByLabel("Your name").fill("Free Trader");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(PASSWORD);
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Create my account" }).click();
    // No verification screen and no email step.
    await page.waitForURL(/\/onboarding/);
    await expect(page.getByText("Check your email")).toHaveCount(0);
    await completeOnboarding(page, "Free Sparks");
    await expect(page).toHaveURL(/\/app/);
    const verified = await withDb(async (db) => (await db.query<{ emailVerified: boolean }>('SELECT "emailVerified" FROM "user" WHERE email = $1', [email])).rows[0]);
    expect(verified?.emailVerified).toBe(true);
  });

  test("paid plan chosen at sign-up ends at checkout after onboarding", async ({ page }) => {
    await withDb((db) => db.query(`DELETE FROM "RateLimitBucket" WHERE "key" LIKE 'registration:%'`));
    const email = uniqueEmail();
    await page.goto("/signup?plan=starter");
    await expect(page.getByRole("radio", { name: /Starter/i })).toBeChecked();
    await page.getByLabel("Your name").fill("Paid Trader");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(PASSWORD);
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Create my account" }).click();
    await page.waitForURL(/\/onboarding/);
    await completeOnboarding(page, "Paid Sparks");
    // Stripe is not configured in tests, so checkout resolves to the mock page.
    await expect(page).toHaveURL(/checkout/);
  });

  test("an existing address is refused instead of silently doing nothing", async ({ page }) => {
    await withDb((db) => db.query(`DELETE FROM "RateLimitBucket" WHERE "key" LIKE 'registration:%'`));
    const email = uniqueEmail();
    for (const attempt of [1, 2]) {
      // Sign-up signs you in, and /signup redirects an authenticated visitor
      // away, so drop the session before trying the address a second time.
      if (attempt === 2) await page.context().clearCookies();
      await page.goto("/signup");
      await page.getByLabel("Your name").fill("Duplicate Trader");
      await page.getByLabel("Email").fill(email);
      await page.locator("#password").fill(PASSWORD);
      await page.getByLabel(/I agree to the/).check();
      await page.getByRole("button", { name: "Create my account" }).click();
      if (attempt === 1) await page.waitForURL(/\/onboarding/);
    }
    await expect(page.getByText(/already exists/i)).toBeVisible();
  });
});
