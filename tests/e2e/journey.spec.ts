import { test, expect } from "@playwright/test";
import path from "node:path";
import { registerAndVerify, completeOnboarding, latestEmailLink, withDb, promoteToSuperAdmin, PASSWORD, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const SCREENSHOTS = path.resolve("docs/screenshots");
let email = "";

test.describe("End-to-end quoting journey", () => {
  test("registration, email verification and onboarding", async ({ page }) => {
    email = await registerAndVerify(page, "Sam Sparks");
    await completeOnboarding(page);
    await expect(page.getByRole("heading", { name: /Price the work|Hello, Sam/ })).toBeVisible();
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Hello, Sam/ })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS, "dashboard.png"), fullPage: true });
  });

  test("create a customer", async ({ page }) => {
    await signIn(page, email);
    await page.goto("/app/customers/new");
    await page.getByLabel("Contact name").fill("Dave Patterson");
    await page.getByLabel("Email").fill("dave.patterson@example.com");
    await page.getByLabel("Telephone").fill("07700 900101");
    await page.getByLabel("Address line 1").first().fill("14 Elm Road");
    await page.getByLabel("Town or city").first().fill("Leeds");
    await page.getByLabel("Postcode").first().fill("LS7 3AB");
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(/\/app\/customers\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Dave Patterson" })).toBeVisible();
  });

  test("new quote from a message with AI analysis, pricing, wording, PDF and sending", async ({ page }) => {
    await signIn(page, email);
    await page.goto("/app/quotes/new");
    await page.waitForURL(/\/app\/quotes\/[0-9a-f-]+\/edit\?step=1/);
    await page.getByLabel("Search customers").fill("Dave");
    await page.getByRole("button", { name: /Dave Patterson/ }).click();
    await page.getByLabel("Quote title").fill("Living room sockets and hallway lighting");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.waitForURL(/step=2/);
    await page.screenshot({ path: path.join(SCREENSHOTS, "new-quote-wizard.png"), fullPage: true });
    await page.getByLabel("Enquiry").fill("Hi, need 2 double sockets putting in the front room either side of the fireplace and the hall light changing to an LED panel. Fuse box is in the garage. Can you do it before the end of the month?");
    await page.getByLabel("Notes", { exact: true }).fill("Solid walls, customer supplying the LED panel.");
    // Photograph upload through the presigned flow (local storage adapter).
    await page.getByLabel("Add photos").setInputFiles(path.resolve("public/brand/icon-512.png"));
    await expect(page.getByRole("img", { name: /icon-512/ })).toBeVisible({ timeout: 30_000 });
    // Voice note upload (mock transcription).
    await page.getByLabel("Upload audio file").setInputFiles({ name: "note.webm", mimeType: "audio/webm", buffer: Buffer.alloc(24_000, 1) });
    await expect(page.getByLabel("Transcript")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Save and analyse" }).click();
    await page.waitForURL(/step=3/);
    await page.getByRole("button", { name: "Analyse with AI" }).click();
    await expect(page.getByRole("heading", { name: "Suggested work" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Photograph observations/)).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS, "ai-analysis.png"), fullPage: true });
    await page.getByRole("button", { name: /Add selected items and price the work/ }).click();
    await page.waitForURL(/step=4/);
    await expect(page.getByRole("heading", { name: "Line items" })).toBeVisible();
    // AI never invents prices: give any unpriced (unmatched) items a price before continuing.
    const priceInputs = page.getByLabel("Unit price", { exact: true });
    for (let i = 0; i < (await priceInputs.count()); i++) {
      const input = priceInputs.nth(i);
      if ((await input.inputValue()) === "0.00") await input.fill("65.00");
    }
    await expect(page.getByText(/need a price|needs a price/)).toHaveCount(0);
    await page.getByRole("button", { name: "Save and write the quote" }).click();
    await page.waitForURL(/step=5/);
    await page.getByRole("button", { name: /generate all sections/i }).click();
    await expect(page.locator("#w-scopeOfWork")).not.toHaveValue("", { timeout: 30_000 });
    await page.getByRole("button", { name: "Save and review" }).click();
    await page.waitForURL(/step=6/);
    await expect(page.getByLabel(/Quote QC-/)).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS, "quote-preview.png"), fullPage: true });
    const pdf = await page.request.get(page.url().replace(/\/edit.*$/, "/pdf"));
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    await page.getByRole("button", { name: "Send by email" }).click();
    await page.getByRole("button", { name: "Send quote" }).click();
    await page.waitForURL(/step=7/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Quote sent" })).toBeVisible();
  });

  test("customer opens the secure link, quote becomes viewed, then accepts", async ({ browser, page }) => {
    const link = await latestEmailLink("dave.patterson@example.com", "QUOTE_SENT", "/q/");
    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await customerPage.goto(link);
    await expect(customerPage.getByText("Awaiting your decision")).toBeVisible();
    await customerPage.screenshot({ path: path.join(SCREENSHOTS, "customer-acceptance.png"), fullPage: true });
    await customerPage.getByRole("button", { name: /Accept quote/ }).click();
    await customerPage.getByLabel("Your full name").fill("Dave Patterson");
    await customerPage.getByLabel(/I have read the quote/).check();
    await customerPage.getByRole("button", { name: "Confirm acceptance" }).click();
    await expect(customerPage.getByText("Quote accepted").first()).toBeVisible();
    await customer.close();

    await signIn(page, email);
    await page.goto("/app/quotes");
    await expect(page.locator("td").getByText("Accepted", { exact: true }).first()).toBeVisible();
    await page.goto("/app/analytics");
    await expect(page.getByText("Value accepted").first()).toBeVisible();
    const accepted = await withDb((db) => db.query(`SELECT count(*)::int AS c FROM "Quote" WHERE status = 'ACCEPTED' AND "createdById" = (SELECT id FROM "user" WHERE email = $1)`, [email]));
    expect(accepted.rows[0].c).toBe(1);
  });

  test("mock Stripe checkout upgrades the plan", async ({ page }) => {
    await signIn(page, email);
    await page.goto("/app/billing");
    await page.getByRole("button", { name: /Upgrade to Pro/ }).click();
    await page.waitForURL(/mock-checkout/);
    await page.getByRole("button", { name: "Simulate successful payment" }).click();
    await page.waitForURL(/checkout=success/);
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
  });

  test("super admin access, user and workspace management", async ({ page }) => {
    await promoteToSuperAdmin(email);
    await signIn(page, email);
    await page.goto("/super-admin");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS, "super-admin-overview.png"), fullPage: true });
    await page.goto("/super-admin/users");
    await expect(page.getByText(email).locator("visible=true").first()).toBeVisible();
    await page.goto("/super-admin/workspaces");
    await expect(page.getByText("E2E Electrical Ltd").locator("visible=true").first()).toBeVisible();
  });

  test("non-admin cannot open super admin or another workspace's quote", async ({ page }) => {
    const other = await registerAndVerify(page, "Other Trader");
    await completeOnboarding(page, "Other Plumbing");
    await page.goto("/super-admin");
    await expect(page).not.toHaveURL(/\/super-admin$/);
    const foreign = await withDb((db) => db.query(`SELECT id FROM "Quote" WHERE "createdById" = (SELECT id FROM "user" WHERE email = $1) LIMIT 1`, [email]));
    const res = await page.goto(`/app/quotes/${foreign.rows[0].id}`);
    expect(res?.status()).toBe(404);
    expect(other).toBeTruthy();
  });

  test("password reset flow revokes and re-signs in", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    const link = await latestEmailLink(email, "PASSWORD_RESET", "/reset-password");
    await page.goto(link);
    await page.locator("#password").fill(`${PASSWORD}-new`);
    await page.locator("#confirm").fill(`${PASSWORD}-new`);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await signIn(page, email, `${PASSWORD}-new`);
    await expect(page).toHaveURL(/\/app/);
  });
});
