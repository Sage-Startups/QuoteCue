# Deploying to Railway

This guide takes a fresh Railway project to a production deployment of QuoteCue AI: one web service, one PostgreSQL database, one private storage bucket and one cron service, all built from this repository's `Dockerfile`. Steps 1–20 are in order; the environment variable table and notes follow.

Prerequisites: a Railway account, this repository on GitHub, a domain (optional), and accounts for Stripe, OpenAI and Resend. Production refuses to start without real Stripe, OpenAI and Resend credentials and a bucket (`src/lib/env.ts`), so have those ready.

## 1. Create the project

In the Railway dashboard create a new empty project (for example "quotecue-production"). Use a separate project for staging if you want one; nothing in the app is shared between environments except the code.

## 2. Add PostgreSQL

Add a **PostgreSQL** database service. Railway provisions PostgreSQL and exposes `DATABASE_URL` (public) and an internal URL on the private network. The app targets PostgreSQL 16.

## 3. Add a private Storage Bucket

Add a **Storage Bucket** service (Railway's S3-compatible object storage). Keep it private (no public access). The bucket service exposes `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID` and `SECRET_ACCESS_KEY`; check the exact names in the bucket's Variables tab.

## 4. Add the application from GitHub

Add a service from the GitHub repository. Railway detects the `Dockerfile` and builds the multi-stage image (dependencies → `prisma generate`, `next build`, `pnpm jobs:build` → slim runtime as user `nextjs` under `tini`). The default command is `./docker/entrypoint.sh web`, which starts the Next.js standalone server on `PORT` (Railway injects it). Name the service `web`.

Build-time note: the image builds with placeholder `DATABASE_URL`/`BETTER_AUTH_SECRET` and `SKIP_ENV_VALIDATION=1`; no service is contacted during the build and no secrets are baked into the image.

## 5. Reference the database

In the `web` service variables add:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

`Postgres` is the name of your database service. Prefer the **internal/private** connection variable Railway offers (private networking keeps database traffic off the public internet and free of egress charges); the public URL is only needed from your own machine (step 18/19). `DIRECT_URL` may be left empty.

## 6. Map the bucket credentials

The exact variable names differ between bucket providers, so open the bucket service's Variables tab and map whatever it exposes onto the names below. If a `${{...}}` reference does not resolve (wrong service name, or a variable the bucket does not publish) Railway injects an empty value, which reads as missing; pasting the literal values works just as well. Any S3-compatible bucket can be used instead with `STORAGE_PROVIDER=s3` (Cloudflare R2, Backblaze B2, AWS S3) since both providers share one client.

```
STORAGE_PROVIDER=railway
STORAGE_BUCKET=${{Bucket.BUCKET}}
STORAGE_ENDPOINT=${{Bucket.ENDPOINT}}
STORAGE_REGION=${{Bucket.REGION}}
STORAGE_ACCESS_KEY_ID=${{Bucket.ACCESS_KEY_ID}}
STORAGE_SECRET_ACCESS_KEY=${{Bucket.SECRET_ACCESS_KEY}}
STORAGE_FORCE_PATH_STYLE=true
```

Replace `Bucket` with the bucket service's name. See [STORAGE.md](STORAGE.md).

## 7. Authentication variables

```
NODE_ENV=production
BETTER_AUTH_SECRET=<output of: openssl rand -base64 48>
APP_URL=https://<your domain>        # update after steps 13/14; must be https
SUPER_ADMIN_EMAIL=you@example.com
```

`BETTER_AUTH_SECRET` must be at least 32 characters; it signs session cookies, local signed URLs and the HMAC-derived customer quote links, so generate it once and keep it (see [HANDOVER.md](HANDOVER.md) on rotation). `APP_URL` is used for absolute links in emails, Stripe return URLs, Better Auth's base URL and trusted origins; set it to the Railway domain first and change it once the custom domain is live. `BETTER_AUTH_URL` is optional and defaults to `APP_URL`.

## 8. Stripe variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...          # from step 15
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_CREDIT_PACK_PRICE_ID=price_...
```

Create the products and prices as described in [STRIPE.md](STRIPE.md). Use test-mode keys for a staging project. The webhook secret does not exist until step 15; put a placeholder for now and update it afterwards (the app only checks that it is present at start-up).

## 9. OpenAI variables

```
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_VISION_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

The three model variables are optional (these are the defaults) and can be overridden later from site settings. See [AI_CONFIGURATION.md](AI_CONFIGURATION.md).

## 10. Resend variables

```
RESEND_API_KEY=re_...
EMAIL_FROM=QuoteCue AI <noreply@yourdomain.com>
SUPPORT_EMAIL=support@yourdomain.com
```

The sending domain must be verified in Resend. See [EMAIL.md](EMAIL.md). Also set `DEMO_MODE=true` if you want the public `/demo` experience (recommended for a sales listing) and optionally `ANALYTICS_ID`.

## 11. Pre-deploy command: migrations

In the `web` service settings set the **pre-deploy command** to:

```
./docker/entrypoint.sh migrate
```

This runs `prisma migrate deploy` with the Prisma CLI bundled in the image before each new deployment receives traffic. Migrations never run automatically at container start, and the database is never seeded by a deploy.

## 12. Health check

Set the service **health check path** to `/api/health`. The route answers `{"status":"ok","database":"ok",...}` with 200 when the database round trip succeeds and 503 otherwise; Railway waits for it before switching traffic. (The Dockerfile's own `HEALTHCHECK` targets the same route.)

## 13. Railway domain

Under Networking, generate a Railway-provided domain (`*.up.railway.app`) for the `web` service on port 3000. Set `APP_URL` to `https://<that domain>` and redeploy. Sign-up, email links and the Stripe return URLs all depend on `APP_URL` matching the address in the browser.

## 14. Custom domain

Add your custom domain to the service, create the CNAME record Railway shows at your DNS provider, wait for the certificate, then set `APP_URL=https://yourdomain.com` and redeploy. Update the Resend sending domain and the Stripe webhook URL if they referenced the Railway domain.

## 15. Stripe webhook

In the Stripe dashboard (Developers → Webhooks) add an endpoint:

```
https://<domain>/api/webhooks/stripe
```

subscribed to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.finalized`
- `invoice.payment_failed`

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy. Other event types are accepted and stored as `IGNORED`.

## 16. Cron service

Add a **second service from the same GitHub repository**, name it `cron`, and set:

- Start command: `./docker/entrypoint.sh jobs`
- Cron schedule: e.g. `0 * * * *` (hourly)
- Variables: the same as `web` (reference the same Postgres and bucket variables, copy the secrets or use shared variables). No domain or health check.

Details, job list and monitoring are in [RAILWAY_CRON.md](RAILWAY_CRON.md).

## 17. Database backups

Enable Railway's PostgreSQL backups on the database service and choose a retention that suits you. In addition, take portable dumps before risky changes and periodically for off-platform safekeeping:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --file quotecue-$(date +%F).dump
```

Files in the bucket are not included in a database dump; sync the bucket separately with an S3-compatible CLI (see [HANDOVER.md](HANDOVER.md)).

## 18. Promote the first super admin

1. Open the site, sign up with the address you set as `SUPER_ADMIN_EMAIL`, and verify the email (Resend delivers it in production).
2. Complete onboarding so the account has a workspace.
3. Promote the account. Either run the command through the Railway CLI, which injects the service's variables:

   ```bash
   railway login
   railway link            # choose the project and the web service
   railway run pnpm admin:promote --email you@example.com
   ```

   or run it from a local checkout with `DATABASE_URL` set to the database's **public** connection URL:

   ```bash
   DATABASE_URL="postgresql://..." pnpm admin:promote --email you@example.com
   ```

   Both need `pnpm install` to have run locally (the command uses `tsx`; the production image does not contain it). The change is written to `AdminAuditLog`.
4. Open `https://<domain>/super-admin`.

Alternatively, run `pnpm db:seed` (step 19) after the account exists: the seed promotes `SUPER_ADMIN_EMAIL` if it matches a registered user.

## 19. Seed the platform data and demo workspace

Production is **never seeded automatically**. After the first deployment, seed plans, trade templates, prompts, email templates and feature flags once:

```bash
railway run pnpm db:seed                      # from the linked web service, or
DATABASE_URL="postgresql://..." pnpm db:seed  # from a local checkout
```

With `DEMO_MODE=true` in the environment the seed also creates the Northstar Electrical Services demo workspace (or pass `SEED_DEMO=true` explicitly). Rebuild the demo at any time with:

```bash
railway run pnpm demo:reset
```

The cron job `reset-demo-workspace` also rebuilds it every `app.demoResetHours` (default 24) while `DEMO_MODE=true`. The seed is idempotent and does not overwrite plans, prompts or templates you have edited.

## 20. Verify the deployment

- [ ] `https://<domain>/api/health` returns `status: ok`
- [ ] Signed in as super admin, `https://<domain>/api/health/system` shows `providers` = `{ ai: "openai", email: "resend", stripe: "stripe", storage: "railway" }` and every check `ok` (the cron check is `ok` after the first heartbeat)
- [ ] `/super-admin` opens and the header badge says `production`
- [ ] Sign up with a second address: verification email arrives, onboarding completes, the sample quote appears
- [ ] Upload a photograph in the wizard: presign → PUT → finalise succeeds and the preview shows
- [ ] Run the AI analysis on a quote: the timeline says "AI analysis completed" (without "(mock provider)")
- [ ] Send a quote to yourself: the email arrives, the `/q/<token>` link opens, the PDF downloads, accepting records the acceptance and the owner receives the notification
- [ ] Buy the credit pack (or a plan) with a real card and refund it: `/app/billing` updates once the webhook is processed; `StripeWebhookEvent` rows are `PROCESSED`
- [ ] Stripe dashboard shows the webhook endpoint healthy
- [ ] The cron service has run at least once: `BackgroundJobRun` contains a `SUCCEEDED` `heartbeat`
- [ ] `/demo` loads when `DEMO_MODE=true`
- [ ] Railway backups are enabled and a manual `pg_dump` succeeded
- [ ] Marketing pages, `robots.txt` and `sitemap.xml` use the custom domain

## Environment variables

| Variable | Required in production | Description |
| --- | --- | --- |
| `NODE_ENV` | yes (`production`) | Enables strict validation, secure cookies, HSTS |
| `PORT` | injected by Railway | Listening port (Dockerfile default 3000) |
| `APP_URL` | yes, `https://` | Public origin used for links, Stripe return URLs and Better Auth |
| `DATABASE_URL` | yes | PostgreSQL connection string (`${{Postgres.DATABASE_URL}}`) |
| `DIRECT_URL` | no | Reserved for a direct (non-pooled) connection; unused at runtime |
| `BETTER_AUTH_SECRET` | yes (32+ chars) | Signs sessions, local URLs and customer quote tokens |
| `BETTER_AUTH_URL` | no | Overrides the auth base URL (defaults to `APP_URL`) |
| `SUPER_ADMIN_EMAIL` | no | Promoted by `pnpm db:seed` if the account exists |
| `STORAGE_PROVIDER` | yes (`railway` or `s3`) | Storage implementation |
| `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | needed for uploads | Bucket credentials (mapped from the bucket service). Missing values no longer stop the app from starting: it logs a warning at boot and only file uploads and downloads fail, so you can deploy first and attach a bucket afterwards |
| `STORAGE_FORCE_PATH_STYLE` | no (default true) | Path-style S3 addressing |
| `LOCAL_STORAGE_PATH` | no | Development only |
| `STRIPE_SECRET_KEY` | yes | Live (or test) secret key |
| `STRIPE_WEBHOOK_SECRET` | yes | Endpoint signing secret |
| `STRIPE_STARTER_MONTHLY_PRICE_ID`, `STRIPE_STARTER_ANNUAL_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_CREDIT_PACK_PRICE_ID` | yes unless stored on the `Plan` rows | Price ids |
| `OPENAI_API_KEY` | yes | OpenAI key |
| `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_TRANSCRIBE_MODEL` | no | Model defaults (`gpt-5.4-mini`, `gpt-5.4-mini`, `gpt-4o-mini-transcribe`) |
| `RESEND_API_KEY` | yes | Resend key |
| `EMAIL_FROM` | yes in practice | Sender on a verified domain (default is `noreply@example.com`, which Resend will reject) |
| `SUPPORT_EMAIL` | no | Seeds the `branding.supportEmail` site setting until an admin sets one in the console; that setting is the support address shown to users and used for contact-form receipts |
| `DEMO_MODE` | no | Enables `/demo`, the demo seed and the demo reset job |
| `ANALYTICS_ID` | no | External analytics id referenced by the legal pages |
| `ALLOW_MOCK_PROVIDERS` | never in production | Test-suite override of production validation |
| `SKIP_ENV_VALIDATION` | build only | Set by the Dockerfile during `next build` |

## Notes

- **Private networking**: Railway services in one project can reach each other over the private network. Use the internal PostgreSQL URL for `DATABASE_URL` in both the `web` and `cron` services; the bucket endpoint is whatever the bucket service exposes.
- **Infrastructure as code**: Railway supports defining a project in a `.railway/railway.ts` file (see Railway's documentation for the current format). This repository does not include one; everything above is configured through the dashboard or the Railway CLI, and an IaC file is optional.
- **Scaling**: the app is stateless (sessions, rate limits and locks live in PostgreSQL; files in the bucket), so the `web` service can run more than one replica. Keep a single cron service.
- **Redeploys**: variable changes require a redeploy. Provider clients (Stripe, OpenAI, Resend, S3) are created once per process.
- **Rollback**: Railway keeps previous deployments; migrations are forward-only, so roll back only to versions compatible with the applied schema.
