# Handover guide

How to transfer QuoteCue AI to a new owner and make it fully theirs. Follow the sections in order; the last section explains how to remove the seller's access. Nothing here needs code changes.

## 1. Assets being transferred

| Asset | Where | Transfer method |
| --- | --- | --- |
| Source code | GitHub repository | Transfer repository ownership (GitHub → Settings → Danger zone → Transfer) to the buyer's account or organisation; or the buyer forks/imports and the seller deletes their copy |
| Railway project | Railway (web service, PostgreSQL, storage bucket, cron service) | Railway project transfer to the buyer's workspace, or recreate from [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) and restore data (section 5) |
| Domain | Registrar | Registrar transfer or push to the buyer's account; update DNS for Railway |
| Stripe | Stripe account | Stripe accounts are tied to the legal entity: the buyer normally creates their own account, recreates products/prices and enters new keys. Existing subscriptions cannot be moved between Stripe accounts without Stripe's involvement |
| Resend | Resend account | Buyer creates an account, verifies the sending domain and issues a new key |
| OpenAI | OpenAI account | Buyer uses their own key |
| Brand assets | `public/brand/*.svg`, generated PNGs, `scripts/generate-brand-assets.ts` | Included in the repository |
| Documentation | `README.md`, `docs/*.md`, `FLIPPA_LISTING_NOTES.md` | Included in the repository |

## 2. Railway project

Preferred: transfer the whole project so the database, bucket contents and service configuration move intact.

1. Buyer creates a Railway account and workspace.
2. Seller transfers the project (Railway project settings) or invites the buyer as a member, after which the buyer removes the seller (section 10).
3. Buyer reviews every variable on the `web` and `cron` services and replaces all secrets (section 4).
4. Buyer enables backups on the PostgreSQL service if not already on.

If the project is recreated instead, follow [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md), then restore the database (section 5) and bucket (section 6) before pointing the domain at the new service.

## 3. GitHub, domain, Stripe, Resend and OpenAI

- **GitHub**: after the transfer, reconnect the Railway services to the repository under its new owner (Railway → service → Source) so deployments continue; check branch and root directory settings.
- **Domain**: transfer the domain, then re-add it to the Railway `web` service and recreate the CNAME. Update `APP_URL` if the hostname changes; it drives email links, Stripe return URLs and Better Auth.
- **Stripe**: in the buyer's account create *Starter* (monthly, annual), *Pro* (monthly, annual) and the *5 extra AI generations* one-off price with the amounts shown in `Plan` (default $19/$190, $39/$390, $9). Set the seven `STRIPE_*` variables (or the `stripe*PriceId` columns on `Plan`), create the webhook endpoint `https://<domain>/api/webhooks/stripe` with the events listed in [STRIPE.md](STRIPE.md), and set the new `STRIPE_WEBHOOK_SECRET`. Any workspaces with subscriptions in the old Stripe account will keep their `Subscription` rows but will no longer receive webhooks; ask those customers to re-subscribe or set them to `COMPLIMENTARY` from the Users page while you migrate them.
- **Resend**: verify the domain (SPF, DKIM), create an API key, set `RESEND_API_KEY` and `EMAIL_FROM`, and confirm `email.ok` in `/api/health/system`.
- **OpenAI**: set the buyer's `OPENAI_API_KEY`; optionally revisit `OPENAI_*_MODEL` and the `ai.*` cost assumptions in site settings ([AI_CONFIGURATION.md](AI_CONFIGURATION.md)). The seller should revoke the old key afterwards.

## 4. Rotate every secret

Replace, in Railway, on both services:

| Secret | Action |
| --- | --- |
| `BETTER_AUTH_SECRET` | Generate a new value (`openssl rand -base64 48`). **Consequences**: every session cookie becomes invalid (all users must sign in again), and every outstanding customer quote link stops working because tokens are HMAC-derived from this secret (`deriveQuoteToken` in `src/lib/services/public-quote.ts`). An old link keeps resolving only until the app next regenerates that quote's link (re-send, copy link, expiry reminder), so treat all sent-but-undecided quotes as needing a **re-send** from the quote page after rotation. Local signed storage URLs (development only) are affected too. Rotate at a quiet time and tell active customers |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Rotate the bucket credentials in Railway (or recreate the bucket service and sync the objects), then update the mapped variables |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | New account or roll the keys in the existing account |
| `RESEND_API_KEY` | New key; delete the old one in Resend |
| `OPENAI_API_KEY` | New key; delete the old one |
| Database password | Rotate the PostgreSQL credentials in Railway and update `DATABASE_URL` references (they follow automatically when using `${{Postgres.DATABASE_URL}}`) |

Redeploy both services after changing variables.

## 5. Export and restore PostgreSQL

Export (from any machine with `pg_dump` matching PostgreSQL 16, using the database's public URL from Railway):

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file quotecue-$(date +%F).dump
```

Restore into an empty database:

```bash
pg_restore --no-owner --no-privileges --dbname "$NEW_DATABASE_URL" quotecue-YYYY-MM-DD.dump
```

The dump includes `_prisma_migrations`, so `./docker/entrypoint.sh migrate` on the next deploy will find the schema up to date. Railway's built-in backups cover day-to-day recovery; take a manual dump immediately before the handover and keep it until the new owner has verified their deployment.

## 6. Back up and move the storage bucket

Bucket objects are not in the database dump. Use any S3-compatible client with the bucket's endpoint and keys, for example the AWS CLI:

```bash
export AWS_ACCESS_KEY_ID=<STORAGE_ACCESS_KEY_ID>
export AWS_SECRET_ACCESS_KEY=<STORAGE_SECRET_ACCESS_KEY>
aws s3 sync "s3://<STORAGE_BUCKET>" ./bucket-backup --endpoint-url "<STORAGE_ENDPOINT>" --region "<STORAGE_REGION>"
# and back into a new bucket:
aws s3 sync ./bucket-backup "s3://<NEW_BUCKET>" --endpoint-url "<NEW_ENDPOINT>" --region "<NEW_REGION>"
```

(`rclone` works equally well.) Object keys must stay identical because `StoredObject.key` references them; `StoredObject.bucket` records the bucket name for information only. Quote PDFs can be regenerated on demand if lost; photographs, audio, documents and logos cannot.

## 7. Rebranding

1. **Names, colours, contact details, SEO**: `branding.*`, `seo.*`, `email.fromName`, `email.footerText` and `announcement.*` in `SiteSetting` (defaults in `src/lib/config/site-settings.ts`), and the copy in `MarketingContent`. Edit them from the super-admin Branding, Site settings and Marketing content pages (validated and audited); editing the rows directly with SQL or Prisma Studio is an alternative ([SUPER_ADMIN.md](SUPER_ADMIN.md) has examples). The legal pages (`/privacy`, `/terms`, `/cookies`) are generated from `branding.companyName`, `branding.companyAddress` and `branding.supportEmail`.
2. **Logo and icons**: replace `public/brand/logo-light.svg`, `logo-dark.svg` and `logo-mark.svg`, then run `pnpm tsx scripts/generate-brand-assets.ts` to regenerate `public/brand/icon-32/64/192/512.png`, `public/favicon-32.png`, `src/app/apple-icon.png`, `public/og-image.png` and `src/app/opengraph-image.png` (the script also contains the social-image text; edit it there). `src/app/icon.svg` is the favicon source. Alternatively upload a logo, favicon and social image on the super-admin Branding page, which stores them as `SITE_ASSET`s and sets `branding.logoObjectId`, `branding.faviconObjectId` and `branding.socialImageObjectId`.
3. **Product name in code**: the string "QuoteCue" appears in a few places outside settings (the Stripe `appInfo` in `src/lib/billing/stripe.ts`, the `appName` in `src/lib/auth/auth.ts`, the mock model names, cookie prefix `quotecue`, `package.json`). Search for `QuoteCue` and `quotecue` before renaming; changing the cookie prefix signs everyone out.
4. **Emails**: templates in `EmailTemplate` reference `{{productName}}` and use the brand colours automatically.
5. **Demo workspace**: the fictional business is defined in `src/lib/seed/demo.ts` if you want a different example trade.

## 8. Changing prices and plans

- Prices displayed come from `Plan` (`monthlyPriceMinor`, `annualPriceMinor`, `oneTimePriceMinor`, `featureBullets`, `aiGenerationsPerPeriod`, `maxMembers`); prices charged come from Stripe. Change both: create new Stripe prices, update the `Plan` row (or the `STRIPE_*` variables), then archive the old prices. Use the super-admin Plans and credits page (`/super-admin/plans`), which verifies Stripe price ids against Stripe when a key is configured; SQL or Prisma Studio are an alternative.
- Trial size: `app.trialCredits` site setting (default 3).
- Entitlements per plan: `PlanEntitlement` rows keyed by `ENTITLEMENT_KEYS` (`src/lib/billing/plans.ts`).

## 9. Demo, super admin and data hygiene

- **Reset the demo**: `railway run pnpm demo:reset` (or the `reset-demo-workspace` cron job, or the *Reset demo* button on `/demo`). Set `DEMO_MODE=false` to hide `/demo` entirely.
- **Create a new super admin**: register the buyer's address, verify it, then `railway run pnpm admin:promote --email buyer@example.com` (or set `SUPER_ADMIN_EMAIL` and run `pnpm db:seed`). Confirm access at `/super-admin`.
- **Remove seller test data**: delete any test workspaces/users from the Users page (audited) so the buyer starts with a clean `Users` list; the demo workspace is recreated by the seed.

## 10. Revoking the seller's access

Do this last, once the buyer has confirmed everything works:

1. **Application**: the buyer demotes or deletes the seller's account from `/super-admin/users` (role → `USER`, or *Delete user* with a reason). The system refuses to delete the last super admin, so promote the buyer first. Optionally run `pnpm admin:promote --email seller@example.com --role USER` from the CLI.
2. **Secrets**: complete section 4; the seller no longer knows any live secret.
3. **GitHub**: remove the seller as collaborator/owner, revoke any deploy keys or personal access tokens, and check GitHub Actions secrets if you added any.
4. **Railway**: remove the seller from the project/workspace members; check for API tokens.
5. **Stripe**: if the account was shared, remove the seller's team member entry and roll the API keys; otherwise the buyer's own account is already separate.
6. **Resend and OpenAI**: remove team members or, more simply, use the buyer's own accounts and delete the old keys.
7. **Domain registrar and DNS**: confirm only the buyer has access.
8. **Database**: rotate the PostgreSQL password (section 4) so any connection string the seller retained stops working.

## 11. Services to expect and what drives cost

Check current pricing with each provider; nothing in this repository fixes a price.

| Service | Purpose | Cost driver |
| --- | --- | --- |
| Railway `web` service | Next.js application | CPU/memory usage and egress; scales with traffic and replicas |
| Railway PostgreSQL | All application data | Storage size and compute; grows with quotes, events and analytics rows |
| Railway Storage Bucket | Photographs, audio, documents, PDFs | Stored bytes and requests; retention jobs limit growth |
| Railway `cron` service | Background jobs | Minutes of run time per schedule (small) |
| OpenAI | Analysis, wording, transcription | Per-token and per-minute usage for every paid generation; estimated in `AiRun.estimatedCostMicros`; the plan allowances (25/100 generations) bound it per customer |
| Resend | Transactional email | Emails per month (verification, quote, notification, reminder) |
| Stripe | Payments | Percentage plus fixed fee per successful charge; no monthly fee for standard accounts |
| Domain and DNS | Public address | Annual renewal |

Optional: a status page, uptime monitoring and an error tracker are not included; the built-in `ApplicationError`, `BackgroundJobRun` and health endpoints cover the basics.

## 12. Handover checklist

- [ ] Repository transferred; Railway reconnected to it
- [ ] Railway project transferred (or recreated and data restored)
- [ ] Domain transferred and DNS pointing at Railway; `APP_URL` correct
- [ ] Stripe products, prices, keys and webhook set up in the buyer's account
- [ ] Resend domain verified and key set; test email received
- [ ] OpenAI key set; a real analysis run shows no "(mock provider)" label
- [ ] `BETTER_AUTH_SECRET` and all keys rotated; both services redeployed; outstanding quotes re-sent
- [ ] Buyer promoted to super admin; seller demoted/removed
- [ ] Seller removed from GitHub, Railway, Stripe, Resend, registrar
- [ ] Database dump and bucket backup handed over and verified
- [ ] Branding, legal details and prices reviewed by the buyer
