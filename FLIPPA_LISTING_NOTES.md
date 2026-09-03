# QuoteCue AI — listing notes

Working notes for a marketplace listing (Flippa or similar). Everything below is drawn from the repository; nothing is a projection. **The product is newly built and has no operating history: there is no revenue, no traffic, no customers and no subscribers to report.** Buyers are purchasing a complete, deployable codebase, brand and documentation, not a trading business.

## One-line summary

QuoteCue AI is a SaaS web application for tradespeople that turns a customer's message, a voice note and job photographs into a priced, branded, professional quote the customer can accept online. Tagline: **"From enquiry to professional quote in minutes."**

## Product summary

A tradesperson pastes the customer's enquiry, records or uploads a voice note and adds photos. The AI analysis proposes the likely work items matched to the tradesperson's own service catalogue, lists what is missing, what to ask the customer and any safety caveats; it never invents prices. The tradesperson prices the work from their catalogue with a deterministic calculator, the AI writes the customer-facing wording (every section editable or regenerable), and the quote goes out by email with a secure link and PDF. The customer views, downloads and accepts or declines online; the business is notified and the quote timeline records every step. Subscription billing, a free trial, credit packs, team accounts, analytics, a public demo and a platform administration console are included.

## Target customers

Sole traders and small teams in the trades: electricians, plumbers, builders, heating engineers, roofers, landscapers, joiners/carpenters, painters and decorators, handymen, cleaning companies, property maintenance and general trades (the twelve built-in trade templates). Anyone who currently quotes from their phone by text, WhatsApp or email and loses jobs to slow or unprofessional quotes. Currencies supported: USD, GBP, EUR, CAD, AUD, NZD with VAT/GST/sales-tax modes; copy is in British English.

## Revenue model (as configured; no sales to date)

| Plan | Price | Includes |
| --- | --- | --- |
| Free trial | $0, no card | 3 AI quote generations, 1 user, PDF with QuoteCue branding, acceptance links, basic analytics |
| Starter | $19/month or $190/year | 25 AI generations per month, 1 user, custom logo, unbranded PDFs, CSV export |
| Pro | $39/month or $390/year | 100 AI generations per month, up to 5 users, full branding, advanced analytics, custom templates, priority support |
| Credit pack | $9 one-off | 5 extra AI generations, never expire, any plan |

Prices, allowances and entitlements live in the database and Stripe and can be changed without code. Cost of goods per generation is the OpenAI usage (estimated and recorded per run) plus email and storage; see `docs/HANDOVER.md` for cost drivers (no prices quoted).

## Complete feature list

**Quoting**
- Seven-step wizard: Customer, Capture the enquiry, AI analysis, Price the work, Generate wording, Review, Confirmation; progress is saved per quote and can be resumed.
- Inputs: pasted customer messages, typed job notes, in-browser voice recording or audio upload with transcription, up to ten job photographs analysed with vision (with caveats), plain-text documents.
- AI analysis output: job summary, detected trade, suggested work items with source/confidence/"requires confirmation", catalogue matches, quantities with provenance (explicit/estimated/unknown), uncertainties, missing information, customer questions, assumptions, photo observations, safety notes, on-site inspection recommendation, readiness verdict.
- Deterministic pricing engine: integer minor units, basis-point percentages, tax-exclusive/inclusive/no-tax, per-line and quote-level discounts (fixed or percentage), optional items, call-out fee, internal cost and margin, labour/material/other kinds, seven unit types.
- AI-written wording: title, summary, scope, inclusions, assumptions, exclusions, customer responsibilities, payment terms, schedule, warranty, validity and follow-up email, plus customer questions; per-section regeneration with instructions (free of charge).
- Quote numbers `QC-YYYY-NNNN`, versions/revisions, duplication, archive/restore (single and bulk), return to draft, reactivate expired quotes, follow-up reminders, timeline of events.
- Branded PDF (`@react-pdf/renderer`) stored privately and regenerated on demand.
- Customer page `/q/<token>`: secure HMAC-derived links with expiry and rotation, view tracking (first view notifies the business), PDF download, accept with typed signature and terms confirmation, decline with reason.
- Status lifecycle Draft → Ready → Sent → Viewed → Accepted / Declined / Expired → Archived, enforced by a state machine; automatic expiry and expiry-reminder emails.

**Workspace and CRM**
- Onboarding creates business settings, a default quote template, a trade-specific starter catalogue and a sample quote.
- Customers (individuals or companies) with tags, billing and job addresses, preferred contact method, notes and quote history.
- Service catalogue with categories, units, prices, internal costs, tax treatment, CSV import and export.
- Quote templates (scope, inclusions, exclusions, assumptions, terms, questions).
- Business settings: identity, address, currency, tax, pricing mode, labour rate, call-out fee, terms, validity, quote prefix, logo, brand colours.
- Analytics dashboard: created/sent/viewed/accepted, values, acceptance rate, average quote, create-to-send time, AI usage, date ranges with previous-period comparison, CSV export (entitled plans).
- Team accounts (Pro): email invitations with roles (member/admin), plan-enforced seat limits.
- Account: profile, password change, session list and revocation, full personal data export (JSON), account deletion with ownership transfer.

**Billing**
- Stripe Checkout (subscriptions and one-off credit packs), Billing Portal, signed webhooks with idempotent processing, invoice mirror, payment-failure handling with grace period, cancel at period end, complimentary plans, promotion codes.
- Period allowance plus purchased credits, append-only credit ledger, credits consumed only after a successful AI run and refunded if storage fails, trial-limit warning emails.
- Entitlements per plan: logo, branding removal, full branding, PDF download, acceptance links, basic/advanced analytics, custom templates, team accounts, CSV export, priority support.
- Clearly labelled mock checkout and portal in development.

**AI**
- OpenAI Responses API with Zod-validated structured outputs, automatic retry, one repair attempt, image inputs, audio transcription, per-run token and cost accounting, error categorisation.
- Versioned prompts with one published version per feature; models and cost assumptions adjustable at runtime; master on/off switch.
- Deterministic mock provider for development, tests and the public demo.

**Email**
- Resend integration; sixteen editable Markdown templates with validated `{{variables}}`; branded HTML and plain-text rendering; preview inbox in development; every send recorded with status and error.

**Marketing site**
- Home, features, how it works, pricing (from the database), templates (twelve trades), about, contact (with honeypot and receipt), FAQ, privacy, terms, cookies; announcement banner; JSON-LD, sitemap, robots, Open Graph image; database-editable copy.

**Public demo (`/demo`)**
- "Northstar Electrical Services": three months of relative-dated sample quotes, customers and activity; dashboard with charts; interactive four-step quote builder using the mock AI; customer view; one-click reset; automatic daily reset.

**Platform administration (`/super-admin`)**
- Overview: platform statistics by date range with previous-period comparison (users, workspaces, subscriptions, churn, credit packs, quotes, AI runs and estimated cost, emails, storage, failed webhooks, cron heartbeat) and a demo-data toggle.
- Users: search, filters, CSV export, user detail with memberships and audit trail; suspend/restore with reason, revoke sessions, send password reset, change platform role, grant or adjust AI credits, apply complimentary plans, delete account. Every action audited.
- Read-only support mode with reason, two-hour expiry, banner and audit trail, started from the workspace detail page.
- Seventeen further sections, all implemented: Workspaces (detail, suspend, deletion, promotional credits, JSON export), Subscriptions (plan mapping, cancel at period end, reconcile with Stripe, invoices and ledger), Plans and credits, Quotes (metadata list; private content needs a recorded reason and is logged to the quote's activity), AI usage, Storage, Email activity with a template editor and test sends, Marketing content, Trade templates, AI prompts with versioning, publish/rollback and a prompt tester, Feature flags, Site settings, Branding with asset uploads, System health, Background jobs, Webhooks with retry, and Audit log with rollback of setting, content and flag changes. Every section is documented in `docs/SUPER_ADMIN.md`.

**Operations and security**
- Public health check and super-admin deep health check (database, storage, Stripe, OpenAI, Resend, cron).
- Nine idempotent background jobs (expiry, reminders, upload clean-up, retention, analytics aggregation, storage snapshots, session/rate-limit clean-up, demo reset, heartbeat) run by a cron service with an advisory lock and per-run records.
- Nonce-based CSP, HSTS and security headers; database-backed rate limits; hashed IPs; token hashing; EXIF stripping; tenant-scoped services; audited admin actions; production refuses mock providers. Details in `docs/SECURITY.md`.

## Technology stack

Next.js 16 (App Router, React 19, TypeScript strict, standalone output), Tailwind CSS 4, Radix UI, Lucide icons, Recharts, react-hook-form/Zod; PostgreSQL 16 with Prisma 7 (`@prisma/adapter-pg`); Better Auth 1.7; AWS SDK v3 S3 client for Railway Storage Bucket; Stripe SDK; OpenAI SDK; Resend SDK; `@react-pdf/renderer`; `sharp`; Vitest and Playwright; pnpm, ESLint, esbuild; Docker (multi-stage image, non-root, tini).

## Railway architecture

One Railway project: a **web service** (Next.js standalone, `node server.js`, health check `/api/health`), **PostgreSQL 16**, a **private Storage Bucket** (S3-compatible; browser uploads go straight to the bucket via presigned URLs), and a **cron service** built from the same image that runs the job runner on a schedule (`./docker/entrypoint.sh jobs`). Migrations run as a pre-deploy command. External services: Stripe, OpenAI, Resend. The app is stateless and can run multiple web replicas. Full guide: `docs/RAILWAY_DEPLOYMENT.md`.

## Included assets

- Complete source code (marketing site, application, customer pages, super-admin console, job runner, Docker image, database schema and migrations, seed data).
- Brand: "QuoteCue AI" name and tagline, logo SVGs (light, dark, mark), generated icons, favicon, social image and the script to regenerate them.
- Twelve trade templates with starter catalogues and the Northstar demo dataset.
- Sixteen email templates, default AI prompts, default site settings and marketing copy.
- Documentation: README, setup, architecture, database, authentication, storage, super admin, Stripe, AI configuration, email, Railway deployment, Railway cron, testing, security, handover, demo script.
- Unit tests for the pricing engine, quote state machine, AI schema validation, utilities and environment validation.

Not included: a domain (the seller's domain may be transferred by agreement), Stripe/Resend/OpenAI/Railway accounts (buyer supplies their own), customer data (none exists), screenshots (see below), CI configuration, end-to-end test specs.

## Setup requirements for the buyer

- Railway account (web service, PostgreSQL, storage bucket, cron service).
- Stripe account with two subscription products (monthly and annual prices) and one one-off price, plus a webhook endpoint.
- OpenAI API key (default models `gpt-5.4-mini` and `gpt-4o-mini-transcribe`, configurable).
- Resend account with a verified sending domain.
- A domain name and DNS access.
- About an hour following `docs/RAILWAY_DEPLOYMENT.md`; no code changes needed. Local development needs Node 22, pnpm 10 and Docker.

## Growth opportunities (not implemented; ideas only)

- Finish the remaining super-admin pages on top of the existing data and services.
- Native mobile capture (camera and microphone shortcuts, PWA install prompts; a web manifest already exists).
- Deposits and payments on acceptance (Stripe Payment Links or Checkout for customers), invoicing after the job.
- Integrations: accounting (Xero, QuickBooks), calendars, WhatsApp/SMS delivery of quote links, job-management tools.
- Additional languages and tax regimes; localisation of the trade templates.
- Automatic follow-up sequences and won/lost reasons to improve acceptance rates.
- Per-trade pricing benchmarks from anonymised catalogue data (with consent).
- Referral and affiliate programme for trade associations and suppliers.
- Content marketing: quote templates and calculators for each trade page.

## Recommended screenshots

`docs/screenshots/` currently holds only `landing-desktop.png`; capture the rest before listing (a Playwright suite writing to that directory is outlined in `docs/TESTING.md`). Use the seeded demo and a development account with the mock providers.

| File | What to capture |
| --- | --- |
| `docs/screenshots/landing-desktop.png` | `/` at 1440 px, hero and the three-input explanation |
| `docs/screenshots/landing-mobile.png` | `/` at 375 px |
| `docs/screenshots/dashboard.png` | `/app` (or `/demo`) with 90-day stats and charts |
| `docs/screenshots/new-quote-wizard.png` | Wizard step 2 with a pasted message, a transcript and photo thumbnails |
| `docs/screenshots/ai-analysis.png` | Wizard step 3 showing suggested work, questions and readiness |
| `docs/screenshots/quote-preview.png` | Wizard step 6 or the quote page preview with branded document |
| `docs/screenshots/customer-acceptance.png` | `/q/<token>` with the accept form |
| `docs/screenshots/super-admin-overview.png` | `/super-admin` overview |

Optional extras: pricing page, billing page with plan cards, analytics page, the email preview inbox, a generated PDF.

## Demonstration sequence

Follow `docs/DEMO_SCRIPT.md` (about ten minutes):

1. Landing page and positioning.
2. `/demo` dashboard, interactive quote builder (enquiry → analysis → pricing → preview), quotes list, customer view, reset.
3. Real app: sign-up and verification, onboarding with a trade template, catalogue.
4. Seven-step wizard on a quote with mock AI: capture, analysis, pricing, wording (with section regeneration), review, send.
5. Customer link: view, PDF, accept; owner notifications and timeline.
6. Analytics, billing with mock checkout and plan change, team invitation.
7. Super-admin overview, user management and a short tour of the other console sections.

## Honest disclosures for the listing

- Newly built; no operating history, revenue, traffic, customers or subscribers.
- All nineteen super-admin sections are implemented. Plans can be edited but not created or deleted from the console, and trade templates are deactivated rather than deleted.
- No end-to-end test suite or CI is committed (unit tests exist; Playwright is installed with a documented plan).
- AI output quality depends on the buyer's OpenAI model choice; prompts are editable.
- Legal page copy (privacy, terms, cookies) is generated from settings and should be reviewed by the buyer's legal adviser for their jurisdiction.
