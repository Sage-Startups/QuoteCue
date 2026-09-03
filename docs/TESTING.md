# Testing

Three layers exist: **unit and integration tests** with Vitest against a real PostgreSQL database, **end-to-end tests** with Playwright at three viewport widths, and the static checks (`pnpm lint`, `pnpm typecheck`). This document describes what is in the repository and how to extend it.

## Unit and integration tests (Vitest)

### Configuration

`vitest.config.ts`:

- includes `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`;
- `environment: "node"`, `fileParallelism: false` (test files run one at a time so they can share the database), `testTimeout` 30 s, `hookTimeout` 60 s;
- aliases `@` to `src` and replaces the `server-only` marker package with `tests/shims/server-only.ts` so server modules can be imported;
- sets the environment for every test: `NODE_ENV=test`, `DATABASE_URL` = `TEST_DATABASE_URL` or `postgresql://postgres:postgres@127.0.0.1:5432/quotecue_test`, a fixed `BETTER_AUTH_SECRET`, `APP_URL=http://localhost:3000`, `STORAGE_PROVIDER=memory`, `DEMO_MODE=false`, `ALLOW_MOCK_PROVIDERS=true` (so `loadEnv` does not reject the mock providers);
- `tests/global-setup.ts` runs `pnpm prisma migrate deploy` against the test database once before the suite;
- `tests/setup.ts` registers a `beforeAll` hook; environment variables come from the config, so it is intentionally minimal.

Under `NODE_ENV=test` the providers resolve to the mock AI provider, the preview email provider (which also stores rendered HTML/text on `EmailEvent`), mock billing and in-memory storage, so integration tests never contact a paid service. `setAiProvider`, `setEmailProvider` and `setStorageProvider` exist to inject fakes.

### Test database

The suite needs a database called `quotecue_test` on the same server as development (the Docker container from `docker-compose.yml` works). Create it once:

```bash
docker compose up -d
docker exec quotecue-postgres createdb -U postgres quotecue_test
# or: psql "postgresql://postgres:postgres@localhost:5432/postgres" -c 'CREATE DATABASE quotecue_test'
```

Point elsewhere with `TEST_DATABASE_URL=postgresql://... pnpm test`. Migrations are applied by the global setup, so the database only has to exist.

### Running

```bash
pnpm test            # vitest run
pnpm test:watch      # vitest in watch mode
pnpm test -- tests/unit/pricing.test.ts   # one file
```

### What is covered today

`tests/unit/` contains four files, all pure unit tests:

| File | Covers |
| --- | --- |
| `pricing.test.ts` | `priceLine` and `calculateQuote` in `src/lib/quotes/pricing.ts`: half-up rounding of quantity × price, percentage discounts in basis points, fixed discounts capped at the line subtotal, rejection of negative quantities/prices, tax-exclusive/inclusive/no-tax totals, call-out fee in the taxable subtotal, percentage and fixed quote-level discounts, optional lines excluded from totals, deterministic rounding to minor units |
| `status.test.ts` | The quote state machine in `src/lib/quotes/status.ts`: normal lifecycle, accepted quotes cannot be re-sent or declined, expiry and decision-window calculations |
| `ai-validation.test.ts` | `enquiryAnalysisSchema` and `quoteWordingSchema` accept the mock fixtures and reject invented prices/invalid shapes; `estimateCostMicros` arithmetic |
| `utils.test.ts` | Money formatting and parsing, date-range presets, CSV round-trip with formula-injection guard, `safeRedirectPath`, token hashing and constant-time comparison, safe Markdown hrefs, email variable validation/substitution and HTML rendering, and `loadEnv` (mocks in development, refusal in production, bucket variables required for `railway`) |

`tests/integration/` contains three database-backed files (each creates its own users and workspaces with unique emails and removes them in `afterAll`):

| File | Covers |
| --- | --- |
| `billing.test.ts` | Trial credits granted at onboarding, `consumeGeneration` idempotency by key, `refundGeneration` restoring a credit after a failed run, the balance never going negative (database CHECK constraint), plan allowance used before purchased credits after a mock upgrade, `processStripeEvent` handling the same Stripe event exactly once, payment-failure and past-due handling |
| `isolation.test.ts` | Workspace isolation for customers, quotes, files and analytics by direct id; atomic quote numbering without duplicates under concurrency; server-side pricing, locked accepted versions and revisions; public token hash verification and link expiry |
| `platform.test.ts` | Upload policy (type and size), presign and finalise against `InMemoryStorage`; email events in preview mode never claiming delivery; audit log previous/new values; the rate limiter by key and window; scheduled jobs running idempotently and expiring overdue quotes once; account deletion removing the solely-owned workspace and its files |

### Adding tests

Unit tests go in `tests/unit/<area>.test.ts` and import from `@/lib/...`. Integration tests go in `tests/integration/<area>.test.ts` and may use `prisma` directly:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedPlatform } from "@/lib/seed/platform";
import { createWorkspaceFromOnboarding } from "@/lib/services/workspace";
import { consumeGeneration } from "@/lib/billing/credits";

describe("credits", () => {
  beforeAll(async () => {
    await seedPlatform();
  });

  it("uses trial credits then refuses", async () => {
    const user = await prisma.user.create({ data: { name: "T", email: `t-${Date.now()}@example.com`, emailVerified: true } });
    const { workspaceId } = await createWorkspaceFromOnboarding(user.id, { /* onboardingSchema input */ } as never);
    for (let i = 0; i < 3; i++) await consumeGeneration({ workspaceId, idempotencyKey: `k${i}` });
    await expect(consumeGeneration({ workspaceId, idempotencyKey: "k3" })).rejects.toThrow();
  });
});
```

Guidelines:

- Create your own users/workspaces with unique emails and clean up in `afterAll`, or wrap in a transaction you roll back; the database is shared across files.
- Seed platform data with `seedPlatform()` when a test needs plans, templates or flags.
- Never depend on real network calls; the mock providers are deterministic. Use `buildMockFixture` to obtain schema-valid AI output.
- Good next integration tests: `rotatePublicLink` invalidating the previous token, `getWorkspaceContext` rejecting a forged workspace cookie, team invitations and role changes, and every remaining job in `src/jobs/registry.ts` run twice to prove idempotency.

## End-to-end tests (Playwright)

`playwright.config.ts` at the repository root defines `testDir: "tests/e2e"`, one worker (the specs share a database and the journey runs serially), a 90 s test timeout, `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, an `en-GB` locale and the `Europe/London` timezone, and three projects:

| Project | Viewport | Specs |
| --- | --- | --- |
| `desktop` | 1440 × 900 (Desktop Chrome) | every spec except `mobile.spec.ts` |
| `tablet` | 768 × 1024 | `responsive.spec.ts` |
| `mobile` | 375 × 812 (Pixel 7, touch) | `responsive.spec.ts`, `mobile.spec.ts` |

By default the config starts its own server with `pnpm exec next dev -p 3100` against `E2E_DATABASE_URL` (default `postgresql://postgres:postgres@127.0.0.1:5432/quotecue_e2e`) with `DEMO_MODE=true`, `STORAGE_PROVIDER=local` (files under `.local-storage-e2e`) and no paid keys, so the mock AI provider, the preview email provider and mock billing are used. The database must exist and be migrated and seeded first:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -c 'CREATE DATABASE quotecue_e2e'
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/quotecue_e2e pnpm db:deploy
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/quotecue_e2e DEMO_MODE=true pnpm db:seed
pnpm test:e2e                       # all projects
pnpm test:e2e -- --project=desktop  # one project
pnpm test:e2e -- tests/e2e/journey.spec.ts
```

To run against a server that is already up (Next.js refuses to start a second `next dev` in the same checkout), set `PLAYWRIGHT_BASE_URL=http://localhost:3000` and point `E2E_DATABASE_URL` at that server's database; the helpers read verification, reset and magic-link emails straight from the `EmailEvent` table with `pg`. `PLAYWRIGHT_CHROMIUM_PATH` overrides the browser binary (the config also picks up `/opt/pw-browsers/chromium` when present); otherwise install one with `pnpm exec playwright install --with-deps chromium`.

### Specs

| File | Scenarios |
| --- | --- |
| `public.spec.ts` | Homepage links to the live demo; the demo quote builder walkthrough with mock AI; demo quote list, detail and customer view; every marketing page renders and internal links resolve |
| `journey.spec.ts` (serial) | Registration → verification link from the preview email → onboarding → dashboard; create a customer; the full seven-step wizard from a pasted message with photo and voice-note uploads, AI analysis, pricing, wording, PDF preview and sending; the customer opens the secure link in a separate browser context (quote becomes *Viewed*) and accepts; mock Stripe checkout upgrades the plan; a promoted super admin reaches the console and manages users and workspaces; a second user cannot open `/super-admin` or the first workspace's quote; password reset revokes sessions and signs in again |
| `responsive.spec.ts` | Landing page fits each viewport without horizontal overflow and has labelled navigation; demo dashboard and quote list adapt; forms have labels and visible keyboard focus; empty and error states render |
| `mobile.spec.ts` | Creates a quote end to end from a phone-sized viewport |

`tests/e2e/helpers.ts` provides `registerAndVerify` (which also clears the registration rate-limit window for the loopback address so repeated runs do not trip the production limit of five sign-ups per ten minutes), `signIn`, `completeOnboarding`, `latestEmailLink`, `promoteToSuperAdmin` and `noHorizontalOverflow`.

### Screenshots

The journey and responsive specs write the screenshots used in the listing to `docs/screenshots/`: `landing-desktop.png`, `landing-mobile.png`, `dashboard.png`, `new-quote-wizard.png`, `ai-analysis.png`, `quote-preview.png`, `customer-acceptance.png` and `super-admin-overview.png`. Re-run the suite to refresh them after UI changes. Failure artefacts (traces, screenshots, `error-context.md`) go to `test-results/` and the HTML report to `playwright-report/`; both directories are git-ignored.

## Static checks

```bash
pnpm lint        # ESLint (eslint.config.mjs, Next.js rules)
pnpm typecheck   # tsc --noEmit with strict TypeScript
```

Run both plus `pnpm test` and `pnpm test:e2e` before every deployment; there is no CI workflow in the repository, so wire these into GitHub Actions or Railway's build if you want them enforced automatically. The quality gate used before handover was `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm jobs:build`, `pnpm build` and `pnpm audit --prod`. The container image itself was not built in the authoring environment (no Docker daemon was available there), so run `docker build -t quotecue .` once on a machine with Docker, or rely on Railway's build, before relying on the image.

## Manual smoke test

The verification checklist at the end of [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) doubles as a manual smoke test for a production deployment, and [DEMO_SCRIPT.md](DEMO_SCRIPT.md) walks through every major feature in about ten minutes.
