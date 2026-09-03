import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
// Allow a pre-installed Chromium (e.g. in CI images) instead of downloading browsers.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-GB",
    timezoneId: "Europe/London",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } }, testMatch: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, hasTouch: true }, testMatch: /(responsive|mobile)\.spec\.ts/ },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next dev -p 3100",
        url: "http://localhost:3100/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          APP_URL: "http://localhost:3100",
          BETTER_AUTH_URL: "http://localhost:3100",
          DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/quotecue_e2e",
          DEMO_MODE: "true",
          STORAGE_PROVIDER: "local",
          LOCAL_STORAGE_PATH: ".local-storage-e2e",
        },
      },
});
