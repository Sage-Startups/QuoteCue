import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/quotecue_e2e";

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

/** Reads the most recent verification (or reset/magic) link stored by the email preview provider. */
export async function latestEmailLink(toEmail: string, kind: string, pathPrefix: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const link = await withDb(async (db) => {
      const res = await db.query<{ textPreview: string | null; htmlPreview: string | null }>(`SELECT "textPreview", "htmlPreview" FROM "EmailEvent" WHERE "toEmail" = $1 AND "kind" = $2 ORDER BY "createdAt" DESC LIMIT 1`, [toEmail, kind]);
      const body = res.rows[0]?.htmlPreview ?? res.rows[0]?.textPreview ?? "";
      const match = body.match(new RegExp(`https?://[^"'\\s<]*${pathPrefix.replace(/\//g, "\\/")}[^"'\\s<]*`));
      return match ? match[0].replace(/&amp;/g, "&") : null;
    });
    if (link) return link;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${kind} email found for ${toEmail}`);
}

export const PASSWORD = "Str0ng-Passw0rd-e2e!";

/** Registers, verifies (via preview email) and signs in a brand-new user. Returns the email. */
export async function registerAndVerify(page: Page, name = "Test Trader"): Promise<string> {
  const email = uniqueEmail();
  // Every project (desktop/tablet/mobile) registers fresh users from the same
  // loopback IP, which would trip the production registration limit.  Reset the
  // registration window for the test IP instead of weakening the limit itself.
  await withDb((db) => db.query(`DELETE FROM "RateLimitBucket" WHERE "key" LIKE 'registration:%'`));
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const link = await latestEmailLink(email, "VERIFY_EMAIL", "/api/auth/verify-email");
  await page.goto(link);
  await page.waitForURL(/\/(app|onboarding|login)/);
  return email;
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(app|onboarding)/);
}

export async function completeOnboarding(page: Page, businessName = "E2E Electrical Ltd"): Promise<void> {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
  await page.getByLabel("Business name").fill(businessName);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Town or city").fill("Leeds");
  await page.getByLabel("Postcode or ZIP").fill("LS1 1AA");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const finish = page.getByRole("button", { name: "Finish setup" });
  await expect(finish).toBeVisible();
  // dispatchEvent avoids Playwright's actionability retry loop: the button is disabled the instant the action starts.
  await finish.dispatchEvent("click");
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

export async function promoteToSuperAdmin(email: string): Promise<void> {
  await withDb((db) => db.query(`UPDATE "user" SET "platformRole" = 'SUPER_ADMIN' WHERE email = $1`, [email]));
}

export async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page should not overflow horizontally").toBeLessThanOrEqual(1);
}
