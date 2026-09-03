# Local development setup

This guide gets QuoteCue AI running on a developer machine. Production deployment is covered separately in [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md).

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 or later | `package.json` declares `engines.node >= 22` |
| pnpm | 10.x | `corepack enable` installs the version pinned in `packageManager` |
| Docker | any recent | Only used for the local PostgreSQL container |
| Stripe CLI | optional | For forwarding test-mode webhooks |

`.npmrc` sets `engine-strict=true` and `auto-install-peers=true`.

## 1. Start PostgreSQL

`docker-compose.yml` defines a single `postgres:16-alpine` service with a persistent volume and a health check:

```bash
docker compose up -d
```

Connection details: host `localhost`, port `5432`, user `postgres`, password `postgres`, database `quotecue`. The Vitest suite expects a second database called `quotecue_test` on the same server (see [TESTING.md](TESTING.md)).

## 2. Create `.env`

```bash
cp .env.example .env
```

Then set at least:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quotecue
BETTER_AUTH_SECRET=<32+ random characters, e.g. openssl rand -base64 48>
APP_URL=http://localhost:3000
STORAGE_PROVIDER=local
DEMO_MODE=true
```

Everything else may stay blank for development. `src/lib/env.ts` validates the file at start-up and switches each provider into a mock mode when its credentials are missing:

| Missing variable | Development behaviour |
| --- | --- |
| `OPENAI_API_KEY` | Mock AI provider returns deterministic fixtures (`src/lib/ai/mock-provider.ts`) |
| `RESEND_API_KEY` | Email preview mode: emails are stored in `EmailEvent` and shown at `/app/dev/emails` |
| `STRIPE_SECRET_KEY` | Mock billing: checkout goes to `/app/billing/mock-checkout`, portal to `/app/billing/mock-portal` |
| `STORAGE_PROVIDER=local` | Files are written under `LOCAL_STORAGE_PATH` (default `.local-storage`, git-ignored) |

Production refuses all four mock modes.

## 3. Install and prepare the database

```bash
pnpm install          # postinstall runs prisma generate -> src/generated/prisma
pnpm db:migrate       # prisma migrate dev (applies prisma/migrations)
pnpm db:seed          # tsx prisma/seed.ts
```

`pnpm db:seed` is idempotent. It seeds:

- plans and entitlements (`src/lib/billing/plans.ts`),
- twelve trade templates (`src/lib/data/trade-templates.ts`),
- AI prompt version 1 for each feature (only if none exists),
- email templates (`src/lib/email/templates.ts`),
- feature flags (`src/lib/config/feature-flags.ts`),
- the **Northstar Electrical Services** demo workspace when `DEMO_MODE=true` or `SEED_DEMO=true`,
- promotes `SUPER_ADMIN_EMAIL` to super admin if that user already exists.

To start again from scratch: `pnpm db:reset` (drops the database, re-applies migrations, seeds).

## 4. Run the app

```bash
pnpm dev
```

Open <http://localhost:3000>.

### First account

1. Go to `/signup`, register with a name, email and a password of at least 10 characters.
2. Registration requires email verification. With no `RESEND_API_KEY` the verification email is not delivered; sign in is blocked until verified, so open the preview inbox instead. The preview inbox lives at `/app/dev/emails` and requires a workspace, so the simplest route for a *first* user is to read the verification link straight from the database:

   ```sql
   SELECT "toEmail", "subject", "textPreview" FROM "EmailEvent" ORDER BY "createdAt" DESC LIMIT 1;
   ```

   (Alternatively set a real `RESEND_API_KEY` from the start.)
3. Follow the verification link; you are signed in automatically and redirected to `/onboarding`.
4. Complete onboarding (business name, trade, currency, tax, labour rate). This creates the workspace, business settings, a default template, the starter catalogue and the trial credits.

### Demo workspace

With `DEMO_MODE=true` the seed creates the demo user `demo@northstar-electrical.example` (no password is set; the account is meant for the `/demo` experience and for super-admin support mode rather than a normal login). Rebuild it at any time with `pnpm demo:reset`. See [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

### Super admin

```bash
pnpm admin:promote --email you@example.com
```

The account must already exist. Then open `/super-admin`. See [SUPER_ADMIN.md](SUPER_ADMIN.md).

## 5. Optional: real providers in development

### OpenAI

Set `OPENAI_API_KEY`. Optional model overrides: `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL` (default `gpt-5.4-mini`) and `OPENAI_TRANSCRIBE_MODEL` (default `gpt-4o-mini-transcribe`). The `ai.textModel`, `ai.visionModel` and `ai.transcribeModel` site settings (`SiteSetting` table) override these without a restart. See [AI_CONFIGURATION.md](AI_CONFIGURATION.md).

### Resend

Set `RESEND_API_KEY` and an `EMAIL_FROM` on a verified sending domain. See [EMAIL.md](EMAIL.md).

### Stripe test mode

1. In the Stripe dashboard (test mode) create two products, *Starter* and *Pro*, each with a monthly and an annual recurring price, plus a one-off *5 extra AI generations* price. Prices are in USD; the seeded catalogue expects $19/$190, $39/$390 and $9 but Stripe is the source of truth for what is charged.
2. Put the price IDs in `.env`:

   ```dotenv
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
   STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
   STRIPE_PRO_MONTHLY_PRICE_ID=price_...
   STRIPE_PRO_ANNUAL_PRICE_ID=price_...
   STRIPE_CREDIT_PACK_PRICE_ID=price_...
   ```

   Price IDs can also be stored on the `Plan` rows (`stripeMonthlyPriceId`, `stripeAnnualPriceId`, `stripeOneTimePriceId`); database values take precedence over the environment. Edit them on the super-admin Plans and credits page (`/super-admin/plans`), or with SQL or `pnpm prisma studio`.
3. Forward webhooks to your machine:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Copy the `whsec_...` signing secret it prints into `STRIPE_WEBHOOK_SECRET` and restart `pnpm dev`.
4. Use Stripe's test card `4242 4242 4242 4242` on the Checkout page.

Details of the billing flow are in [STRIPE.md](STRIPE.md).

## 6. Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test          # requires the quotecue_test database
```

## 7. Running the job runner locally

```bash
pnpm jobs:run --list                      # print the registered jobs
pnpm jobs:run                             # run all jobs once
pnpm jobs:run --only heartbeat,cleanup-sessions
```

Results are written to the `BackgroundJobRun` table. See [RAILWAY_CRON.md](RAILWAY_CRON.md).

## 8. Building the production image locally (optional)

```bash
docker build -t quotecue .
docker run --rm -p 3000:3000 --env-file .env -e NODE_ENV=production quotecue
```

Remember that production mode refuses mock providers; supply real keys or run with `NODE_ENV=development`.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Invalid environment configuration: BETTER_AUTH_SECRET must be at least 32 characters` | Generate a longer secret |
| `Refusing to start in production: ...` | `NODE_ENV=production` with missing keys or local storage; use development locally |
| `STORAGE_PROVIDER=railway requires: STORAGE_BUCKET, ...` | Map all five bucket variables, or use `local` in development |
| Sign-in says "Please verify your email address first" | Read the verification link from the preview inbox or `EmailEvent` |
| Prisma client errors after pulling changes | `pnpm prisma:generate` and `pnpm db:migrate` |
| Uploads fail in development | Check `.local-storage` is writable and `APP_URL` matches the browser origin (signed local URLs include the origin) |
