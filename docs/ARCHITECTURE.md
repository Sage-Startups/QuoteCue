# Architecture

## Overview

QuoteCue AI is a single Next.js 16 application (App Router, React 19, TypeScript strict) backed by PostgreSQL 16 through Prisma 7. The same Docker image runs as a **web service** and, with a different start command, as a **cron service** that executes background jobs once and exits. Files live in a private S3-compatible bucket. Stripe, OpenAI and Resend are called server-side only.

```
Browser ──HTTPS──► Railway web service (Next.js standalone, node server.js)
                     │  ├─ src/proxy.ts: CSP nonce + security headers + auth redirect shortcut
                     │  ├─ Server Components / Server Actions / Route Handlers
                     │  └─ src/lib/* services (all authorisation happens here)
                     ├──► PostgreSQL (Prisma + pg adapter)
                     ├──► Storage bucket (AWS SDK v3, presigned URLs)
                     ├──► Stripe / OpenAI / Resend
Browser ──PUT──────► Storage bucket (presigned upload, never through the app)
Railway cron ──────► same image, `entrypoint.sh jobs` → dist/jobs/run.js
```

## Repository layout

```
.
├── Dockerfile                  Multi-stage image: deps → build → runtime (non-root, tini)
├── docker/entrypoint.sh        web | jobs | migrate
├── docker-compose.yml          Local PostgreSQL only
├── prisma/
│   ├── schema.prisma           Data model (see DATABASE.md)
│   ├── migrations/             SQL migrations
│   └── seed.ts                 Platform + optional demo seed
├── prisma.config.ts            Prisma 7 config (schema, migrations, seed command, datasource)
├── scripts/
│   ├── admin-promote.ts        pnpm admin:promote
│   ├── demo-reset.ts           pnpm demo:reset
│   ├── build-jobs.ts           esbuild bundle of the job runner → dist/jobs/run.js
│   └── generate-brand-assets.ts  PNG icons and social image from public/brand SVGs
├── public/brand/               Logo SVGs and icon PNGs
├── src/
│   ├── proxy.ts                Edge proxy (security headers, CSP nonce, UX redirect)
│   ├── app/                    Routes
│   │   ├── (marketing)/        Public site: /, features, how-it-works, pricing, templates, about, contact, faq, legal
│   │   ├── (auth)/             login, signup, verify-email, forgot-password, reset-password, magic-link (+ actions.ts)
│   │   ├── onboarding/         Workspace creation after first sign-in
│   │   ├── app/                Authenticated product (dashboard, quotes, customers, catalogue, templates,
│   │   │                       analytics, team, billing, settings, account, help, dev/emails)
│   │   ├── q/[token]/          Public customer quote page and PDF
│   │   ├── invite/[token]/     Team invitation acceptance
│   │   ├── super-admin/        Platform console (layout, shared helpers, support-mode actions)
│   │   └── api/                Route handlers (auth, health, uploads, files, storage/local, webhooks/stripe)
│   ├── components/             UI: ui/, app/, wizard/, quotes/, billing/, admin/, marketing/, ...
│   ├── generated/prisma/       Generated Prisma client (git-ignored)
│   ├── jobs/                   registry.ts (job definitions) and run.ts (runner)
│   └── lib/
│       ├── env.ts              Environment validation and provider resolution
│       ├── auth/               Better Auth instance, session helpers and guards
│       ├── db/                 Prisma client with @prisma/adapter-pg
│       ├── storage/            StorageProvider interface + railway/local/memory implementations
│       ├── billing/            plans, entitlements, credits, stripe
│       ├── ai/                 provider interface, openai/mock providers, runner, schemas, prompts
│       ├── email/              providers (resend/preview), send, render, templates
│       ├── pdf/                @react-pdf/renderer quote document
│       ├── quotes/             pricing.ts (deterministic arithmetic), status.ts (state machine)
│       ├── services/           Application services (quotes, quote-ai, quote-delivery, public-quote,
│       │                       uploads, customers, catalogue, team, workspace, account, analytics, audit, ...)
│       ├── config/             site-settings, feature-flags, marketing-content (DB-backed, cached)
│       ├── security/           headers.ts (CSP), rate-limit.ts (PostgreSQL buckets)
│       ├── seed/               platform.ts, demo.ts
│       ├── data/               trade-templates.ts (12 trades)
│       └── utils/              money, dates, tokens, redirect, csv, safe-markdown, result, ...
└── tests/                      unit/, integration/, e2e/, setup.ts, global-setup.ts, shims/
```

## Request flow

1. **Edge proxy** (`src/proxy.ts`) runs for every non-static request. It generates a per-request CSP nonce, sets security headers and, purely as a UX shortcut, redirects visitors without a session cookie away from `/app`, `/super-admin` and `/onboarding`. It is not a security boundary.
2. **Pages and layouts** are Server Components. Each protected page calls a guard from `src/lib/auth/session.ts` (`requireWorkspaceForPage`, `requireSuperAdminForPage`, ...). The `app/` layout resolves the workspace context and renders the shell with plan usage, support-mode banner and navigation.
3. **Mutations** are Server Actions colocated with their route (`actions.ts`). Every action re-validates the session and workspace and returns an `ActionResult` (`ok`/`fail`) rather than throwing to the client. Errors are converted with `toUserMessage`, which hides internals in production.
4. **Route handlers** under `src/app/api` exist only where a plain HTTP endpoint is required: Better Auth, health checks, upload presign/finalise, authenticated file proxy, local-storage shims, and the Stripe webhook.
5. **Services** in `src/lib/services` contain the business logic and are the only place that touches Prisma for tenant data. They always take a `workspaceId` and scope every query by it.

## Multi-tenancy

- A **User** can belong to several **Workspaces** through **WorkspaceMember** (roles `MEMBER`, `ADMIN`; the workspace owner is always treated as admin).
- Every tenant-owned table carries `workspaceId`. Services never look up a record by id alone.
- The active workspace id is remembered in the `quotecue.workspace` cookie but is re-validated against membership on every request (`getWorkspaceContext`). If the cookie is stale the first membership is used.
- Super admins may hold a time-boxed, read-only **support session** on a workspace (`SupportSession`, see [SUPER_ADMIN.md](SUPER_ADMIN.md)); a session is started from the workspace detail page in the console. Write guards (`requireWritableWorkspace`, `requireWorkspaceRole`) reject support sessions.

## Quote pipeline

| Step | Service | Notes |
| --- | --- | --- |
| Create | `services/quotes.ts createQuote` | Allocates `QC-YYYY-NNNN` from `QuoteCounter`, creates version 1 |
| Capture | `updateEnquiry`, `attachQuoteMedia` | Text, notes, media (images/audio/documents) |
| Transcribe | `services/quote-ai.ts transcribeQuoteAudio` | Not credit-consuming |
| Analyse | `analyseQuoteEnquiry` | Runs `ENQUIRY_ANALYSIS` with up to 8 images and 3 text documents; consumes one generation only after validation; catalogue ids are checked against the workspace |
| Price | `saveLineItems` + `quotes/pricing.ts` | Pure arithmetic with `decimal.js`; AI is never involved in numbers |
| Wording | `generateQuoteWording`, `regenerateSection` | Full wording consumes a generation; single-section regeneration does not |
| Review | `services/quote-document.ts buildQuoteDocument` | One customer-safe document model used by the web preview, the public page and the PDF |
| Send | `services/quote-delivery.ts sendQuoteToCustomer` | Generates the PDF, ensures the public link, emails the customer, moves to `SENT` |
| Customer | `services/public-quote.ts` | Token lookup by hash, view tracking, accept/decline with locking of the version |

Status transitions are enforced by `src/lib/quotes/status.ts`.

## Provider abstraction

Each external dependency sits behind a small interface with a production implementation and a development/test fallback, selected once from the environment:

| Concern | Interface | Implementations |
| --- | --- | --- |
| Storage | `StorageProvider` (`src/lib/storage/types.ts`) | `RailwayBucketStorage` (railway/s3), `LocalFileStorage`, `InMemoryStorage` |
| AI | `AiProvider` (`src/lib/ai/provider.ts`) | `OpenAiProvider`, `MockAiProvider` |
| Email | `EmailProvider` (`src/lib/email/providers.ts`) | `ResendEmailProvider`, `PreviewEmailProvider` |
| Billing | `getStripe()` returns `Stripe | null` | Real client, or mock checkout/portal pages in non-production |

`src/lib/env.ts` computes `env.providers` and refuses to start in production with any fallback active.

## Configuration stored in the database

Rather than redeploying for copy or policy changes, several things are stored in the database and cached briefly in memory (15 seconds). They are edited from the super-admin console (the Site settings, Branding, Marketing content, Feature flags, AI prompts and Email templates pages), which validates each value and records the change in the audit log; SQL or Prisma Studio are an alternative (see [SUPER_ADMIN.md](SUPER_ADMIN.md)):

- **Site settings** (`SiteSetting`, `src/lib/config/site-settings.ts`): branding, SEO, registration switch (the `app.maintenanceMode` switch is enforced by `MaintenanceGate` in the root layout; super admins, the console, API routes and sign-in routes stay open), trial credits, upload limits and MIME lists, retention periods, public-link validity, demo reset interval, email sender details, AI enable switch, model overrides and cost assumptions, announcement banner.
- **Marketing content** (`MarketingContent`): homepage sections, pricing/about/contact copy, footer, per-page SEO.
- **Feature flags** (`FeatureFlag`): voice recording, photo analysis, email sending, customer acceptance, team accounts, advanced analytics, magic-link login, experimental.
- **AI prompts** (`AiPromptVersion`): versioned, one published version per feature.
- **Email templates** (`EmailTemplate`): subject, preview text and Markdown body with `{{variables}}`.
- **Plans** (`Plan`, `PlanEntitlement`): prices shown, allowances, Stripe price ids.

## Background processing

There is no in-process queue. Work that must happen later (expiry, reminders, retention, aggregation, cleanup) is expressed as idempotent jobs in `src/jobs/registry.ts` and executed by `src/jobs/run.ts`, which the cron service runs on a schedule. See [RAILWAY_CRON.md](RAILWAY_CRON.md).

## Build and runtime

- `next.config.ts`: `output: "standalone"`, `poweredByHeader: false`, `serverExternalPackages` for `@react-pdf/renderer`, `sharp`, `pg` and the Prisma adapter, Server Action body limit 4 MB, no remote image patterns (all files go through signed URLs or the proxy).
- `Dockerfile`: `node:22-bookworm-slim`; dependencies installed with `--frozen-lockfile --ignore-scripts`; `prisma generate`, `next build` and `pnpm jobs:build` run with placeholder `DATABASE_URL`/`BETTER_AUTH_SECRET` and `SKIP_ENV_VALIDATION=1` (no services are contacted during build); production dependencies are pruned and copied as `jobs_node_modules` for the runner; the container runs as user `nextjs` under `tini` and exposes port 3000 with a `HEALTHCHECK` on `/api/health`.
- `docker/entrypoint.sh`: `web` → `node server.js`; `jobs` → `node dist/jobs/run.js`; `migrate` → `prisma migrate deploy` using the bundled Prisma CLI.

## Observability

- `/api/health` (public): database round trip, used by Railway.
- `/api/health/system` (super admin): database and migration count, storage bucket, Stripe, OpenAI, Resend and last cron heartbeat, with latencies. The System health console page runs the same checks and links to this endpoint; call it directly while signed in as a super admin when JSON is needed. The overview page shows the heartbeat.
- `ApplicationEvent`: first-party product events (registration, onboarding, quote lifecycle, billing). Properties contain identifiers and numbers only.
- `ApplicationError`: captured server errors with scope and metadata.
- `AdminAuditLog`: every super-admin and CLI change with actor, before/after values and hashed IP.
- `BackgroundJobRun`: outcome of every job execution.
