# QuoteCue AI

**From enquiry to professional quote in minutes.**

QuoteCue AI is a multi-tenant SaaS application for tradespeople (electricians, plumbers, builders, heating engineers and similar trades). It turns the messy inputs a tradesperson already receives — a customer's text message, a voice note recorded on site and a handful of job photos — into a priced, branded, professional quote that the customer can accept online.

This repository contains the complete application: marketing site, customer-facing quote pages, the authenticated app, a super-admin console, a background job runner and everything needed to deploy on Railway.

---

## Contents

- [What it does](#what-it-does)
- [Feature overview](#feature-overview)
- [Architecture](#architecture)
- [Quick start (local development)](#quick-start-local-development)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [Documentation](#documentation)
- [Ownership and licence](#ownership-and-licence)

---

## What it does

1. A tradesperson pastes the customer's message, records or uploads a voice note and adds job photographs.
2. The AI analysis proposes work items matched against the workspace's own service catalogue, lists assumptions, missing information, questions for the customer and safety caveats. It never invents prices.
3. The tradesperson prices the work from their catalogue (labour, materials, call-out fee, discounts, tax).
4. The AI writes the customer-facing wording: scope, inclusions, exclusions, assumptions, payment terms, schedule, warranty and a follow-up email. Every section can be edited or regenerated individually.
5. The quote is sent by email with a secure customer link and a PDF. The customer views it, downloads the PDF and accepts or declines online. The workspace is notified and the quote's timeline records every step.

## Feature overview

**Quoting**
- Seven-step quote wizard: customer, enquiry capture, AI analysis, pricing, wording, review, confirmation.
- Inputs: pasted messages, typed job notes, browser voice recording or audio upload (transcribed), photographs (analysed with vision), plain-text documents.
- Deterministic pricing engine (integer minor units, basis-point percentages, tax-inclusive/exclusive/no-tax modes, line and quote discounts, optional items, internal cost and margin).
- Quote versions, revisions, duplication, archive/restore, reactivate expired quotes, follow-up reminders.
- Branded PDF generated with `@react-pdf/renderer` and stored privately in the storage bucket.
- Public customer page (`/q/<token>`) with view tracking, PDF download and accept/decline with typed signature and terms confirmation.
- Quote status lifecycle: Draft → Ready → Sent → Viewed → Accepted / Declined / Expired → Archived.

**Workspace**
- Onboarding creates business settings, a default quote template and a trade-specific starter catalogue (12 trade templates).
- Customers with tags, billing and job addresses; service catalogue with CSV import/export; quote templates.
- Analytics dashboard (created/sent/viewed/accepted, values, acceptance rate, create-to-send time, AI usage) with date ranges.
- Team accounts (Pro): invitations, member/admin roles.
- Personal account: profile, password change, session revocation, data export, account deletion.

**Billing**
- Free trial (3 AI generations, no card), Starter ($19/month), Pro ($39/month), annual billing at ten times the monthly price, and a 5-generation credit pack ($9).
- Stripe Checkout, Billing Portal, signed webhooks with an idempotency table, invoices, payment-failure handling.
- Entitlements per plan (logo, branding removal, analytics, templates, team size, CSV export). Clearly labelled mock billing when Stripe keys are absent in development.

**AI**
- OpenAI Responses API with Zod-validated structured outputs, one automatic repair attempt, image inputs and audio transcription.
- Prompt versions editable and publishable from the super-admin console; cost estimates recorded per run.
- Deterministic mock provider when no API key is configured (development and tests only).

**Platform administration (`/super-admin`)**
- **Overview** (platform statistics by date range with previous-period comparison and a demo-data toggle) and **Users** (search, filters, CSV export, user detail with memberships and audit trail; suspend/restore, revoke sessions, send password reset, change role, grant credits, apply complimentary plan, delete; every action audited with a reason).
- Also implemented: Workspaces, Subscriptions, Plans and credits, Quotes, AI usage, Storage, Email activity (with a template editor), Marketing content, Trade templates, AI prompts (with a prompt tester), Feature flags, Site settings, Branding, System health, Background jobs, Webhooks and Audit log (with rollback); each section's filters, exports and audited actions are described in [docs/SUPER_ADMIN.md](docs/SUPER_ADMIN.md).
- Read-only, time-boxed support mode with a recorded reason, banner and audit trail, started from the workspace detail page in the console.

**Operations**
- Background job runner for Railway Cron (expiry, reminders, retention, analytics aggregation, storage snapshots, cleanup, demo reset, heartbeat).
- Health endpoints, first-party event tracking, application error log.
- Demo workspace ("Northstar Electrical Services") with three months of relative-dated sample data.

## Architecture

```
                         ┌──────────────────────────────────────────────┐
   Browser               │  Railway project                             │
   ───────               │                                              │
   Marketing site  ───►  │  ┌──────────────────────┐   ┌─────────────┐  │
   App (/app)      ───►  │  │ web service          │──►│ PostgreSQL  │  │
   Customer (/q)   ───►  │  │ Next.js 16 standalone│   │ 16          │  │
   Super admin     ───►  │  │ node server.js       │   └─────────────┘  │
                         │  │ /api/health          │          ▲         │
   Presigned PUT   ───┐  │  └──────────┬───────────┘          │         │
   (direct upload)    │  │             │ S3 API               │         │
                      │  │             ▼                      │         │
                      └─►│  ┌──────────────────────┐   ┌──────┴──────┐  │
                         │  │ Storage Bucket       │◄──│ cron service│  │
                         │  │ (private objects)    │   │ entrypoint  │  │
                         │  └──────────────────────┘   │ jobs (hourly│  │
                         │                             │ or daily)   │  │
                         │                             └─────────────┘  │
                         └──────────────────────────────────────────────┘
                                   │             │             │
                                   ▼             ▼             ▼
                               Stripe         OpenAI        Resend
                        (Checkout, Portal,  (Responses API, (transactional
                         signed webhooks)   transcription)   email)
```

- **Web service** and **cron service** are built from the same `Dockerfile`; the cron service simply overrides the start command with `./docker/entrypoint.sh jobs`.
- Migrations run as a Railway pre-deploy command (`./docker/entrypoint.sh migrate`), never automatically at container start.
- All user files are private bucket objects served through short-lived presigned URLs or authenticated proxy routes.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the code layout and request flow.

### Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, standalone output), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, Radix UI primitives, Lucide icons, Recharts |
| Database | PostgreSQL 16, Prisma 7 with `@prisma/adapter-pg` |
| Auth | Better Auth 1.7 (Prisma adapter, email + password with verification, password reset, magic link, database sessions) |
| Storage | Railway Storage Bucket via AWS SDK v3 (S3-compatible); local filesystem in development; in-memory in tests |
| Billing | Stripe (Checkout, Billing Portal, webhooks) |
| AI | OpenAI official SDK (Responses API structured outputs, vision, transcription), Zod validation |
| Email | Resend; preview mode stores emails in the database when no key is configured |
| PDF | `@react-pdf/renderer` |
| Images | `sharp` (re-encode, resize, strip metadata) |
| Testing | Vitest (unit and integration), Playwright (end-to-end) |
| Tooling | pnpm, ESLint, `tsx`, `esbuild` (job runner bundle) |

## Quick start (local development)

Prerequisites: Node.js 22+, pnpm 10 (`corepack enable`), Docker (for PostgreSQL).

```bash
# 1. Database
docker compose up -d            # PostgreSQL 16 on localhost:5432 (postgres/postgres, db quotecue)

# 2. Environment
cp .env.example .env
# Set BETTER_AUTH_SECRET (32+ characters), e.g. openssl rand -base64 48

# 3. Install, migrate, seed
pnpm install                    # also runs prisma generate
pnpm db:migrate                 # applies migrations (prisma migrate dev)
pnpm db:seed                    # plans, trade templates, prompts, email templates, flags
                                # + demo workspace when DEMO_MODE=true

# 4. Run
pnpm dev                        # http://localhost:3000
```

Without paid credentials the app runs in clearly labelled mock modes: mock AI fixtures, email preview inbox at `/app/dev/emails`, mock Stripe checkout at `/app/billing/mock-checkout`, and files stored under `.local-storage/`. Production refuses all of these (see `src/lib/env.ts`).

Full instructions, including Stripe test mode and webhooks, are in [docs/SETUP.md](docs/SETUP.md).

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js development server |
| `pnpm build` | Production build (standalone output) |
| `pnpm start` | Runs the built standalone server (`node .next/standalone/server.js`) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest run (unit and integration) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm prisma:generate` | Regenerates the Prisma client into `src/generated/prisma` |
| `pnpm db:migrate` | `prisma migrate dev` (development) |
| `pnpm db:deploy` | `prisma migrate deploy` (production) |
| `pnpm db:seed` | Seeds platform data (and the demo workspace when `DEMO_MODE=true` or `SEED_DEMO=true`) |
| `pnpm db:reset` | Drops and recreates the database, then seeds |
| `pnpm jobs:run` | Runs the background job runner once (`--list`, `--only a,b`) |
| `pnpm jobs:build` | Bundles the job runner to `dist/jobs/run.js` (used by the Docker image) |
| `pnpm admin:promote` | Promotes a registered user: `pnpm admin:promote --email someone@example.com` |
| `pnpm demo:reset` | Rebuilds the Northstar Electrical Services demo workspace |

## Environment variables

The full list with descriptions is in `.env.example`; validation lives in `src/lib/env.ts`. Summary:

| Group | Variables |
| --- | --- |
| Application | `APP_URL`, `NODE_ENV`, `PORT`, `DEMO_MODE`, `ANALYTICS_ID` |
| Database | `DATABASE_URL`, `DIRECT_URL` (optional) |
| Auth | `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL` (optional), `SUPER_ADMIN_EMAIL` |
| Storage | `STORAGE_PROVIDER` (`railway` \| `s3` \| `local` \| `memory`), `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_FORCE_PATH_STYLE`, `LOCAL_STORAGE_PATH` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_MONTHLY_PRICE_ID`, `STRIPE_STARTER_ANNUAL_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_CREDIT_PACK_PRICE_ID` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_TRANSCRIBE_MODEL` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL` (validated but unused at runtime; the support address comes from the `branding.supportEmail` site setting) |
| Tests only | `ALLOW_MOCK_PROVIDERS`, `TEST_DATABASE_URL` |

In production (`NODE_ENV=production`) the app refuses to start unless `OPENAI_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set, `STORAGE_PROVIDER` is `railway` or `s3`, and `APP_URL` uses `https://`.

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/SETUP.md](docs/SETUP.md) | Local development setup, mock modes, Stripe test mode |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code layout, request flow, key services |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema overview, conventions, migrations, seeding |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | Better Auth configuration, sessions, roles, guards |
| [docs/STORAGE.md](docs/STORAGE.md) | Storage providers, upload flow, file access |
| [docs/SUPER_ADMIN.md](docs/SUPER_ADMIN.md) | Super-admin console, promotion, support mode |
| [docs/STRIPE.md](docs/STRIPE.md) | Plans, checkout, webhooks, entitlements and credits |
| [docs/AI_CONFIGURATION.md](docs/AI_CONFIGURATION.md) | Providers, models, prompts, validation, costs |
| [docs/EMAIL.md](docs/EMAIL.md) | Resend, templates, preview mode |
| [docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md) | Step-by-step production deployment |
| [docs/RAILWAY_CRON.md](docs/RAILWAY_CRON.md) | Cron service and background jobs |
| [docs/TESTING.md](docs/TESTING.md) | Unit, integration and end-to-end testing |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and controls |
| [docs/HANDOVER.md](docs/HANDOVER.md) | Transferring the product to a new owner |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Ten-minute product walkthrough |
| [FLIPPA_LISTING_NOTES.md](FLIPPA_LISTING_NOTES.md) | Listing notes for a sale |

## Ownership and licence

QuoteCue AI is proprietary software. All source code, brand assets, documentation and sample data in this repository are the property of the current owner and are transferred in full with the sale of the product. No open-source licence is granted by this repository. Third-party dependencies remain under their own licences (see `package.json` and `pnpm-lock.yaml`).

The product is newly built and has no operating history; nothing in this repository should be read as a claim about revenue, traffic or customer numbers.
