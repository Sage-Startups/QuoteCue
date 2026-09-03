# Security

This document describes the threat model QuoteCue AI is built for, the controls implemented in the code, what the system never exposes, the rate limits, and how to report a problem. Paths refer to the source so each claim can be checked.

## Threat model

QuoteCue AI is a multi-tenant SaaS holding tradespeople's customer details, job photographs, voice notes and priced quotes, plus customers' names and acceptance signatures. The main threats considered:

| Threat | Primary controls |
| --- | --- |
| Cross-tenant data access (one workspace reading another's data) | Every service takes a `workspaceId` and scopes each query by it; the workspace cookie is re-validated against membership on every request; files require membership; presigned URLs are short-lived |
| Account takeover (credential stuffing, enumeration, session theft) | Email verification, 10–128 character passwords, database sessions with 7-day expiry, rate limits per IP/email, neutral responses, sessions revoked on password reset, suspension hook, secure cookies |
| Forged or replayed billing events | Stripe signature verification on the raw body, idempotent `StripeWebhookEvent` processing, subscription state only ever written from Stripe data |
| Guessable or leaked customer quote links | 256-bit HMAC-derived tokens, only SHA-256 hashes stored, expiry, rotation, workspace/status checks, rate limiting |
| Malicious uploads (oversized files, wrong types, path traversal, EXIF/GPS leakage) | Policy validation before presign, size re-check on finalise, random keys, `sharp` re-encoding that strips metadata, MIME/extension agreement |
| Prompt injection and unsafe AI output | Structured outputs validated with Zod, numbers never taken from the model, catalogue ids validated against the workspace, safety rules in every prompt, one bounded repair attempt |
| XSS, clickjacking, open redirects, CSRF | Nonce-based CSP with `strict-dynamic`, `frame-ancestors 'none'`, restricted Markdown renderer with escaped output, `safeRedirectPath`, Better Auth origin checks, Server Actions bound to `APP_URL` |
| Privilege escalation to the platform console | `platformRole` checked server-side in the layout, every action and route; roles changed only by CLI, seed or an audited admin action; last super admin cannot be deleted |
| Abuse of expensive operations (AI, email, exports, uploads) | Database-backed rate limits, entitlement checks, credits consumed only after success |
| Operator error and insider access | Audit log with before/after values, support mode is read-only, time-boxed and audited, production refuses mock providers |

Out of scope: denial of service at the network level (Railway's edge), compromise of Railway, Stripe, OpenAI or Resend themselves, and endpoint security of users' devices.

## Controls in the code

### Authentication and sessions (`src/lib/auth/*`, `src/app/(auth)/actions.ts`)

- Better Auth with the Prisma adapter; passwords are hashed by Better Auth's default scheme (scrypt); the hash lives in `Account`, never on `User`.
- Email verification is required before sign-in; verification links expire after 1 hour, password-reset links after 1 hour, magic links after 10 minutes, and magic links cannot create accounts.
- Sessions are database rows: 7-day expiry, refreshed daily, `quotecue`-prefixed cookies, `secure` in production. Users can list and revoke their other sessions; admins can revoke all sessions; password reset revokes every session.
- A `session.create.before` hook refuses suspended or deleted users even with valid credentials.
- `trustedOrigins` is `[APP_URL]`, so cross-origin requests to the auth API are rejected.
- Enumeration safety: sign-up with an existing address returns the normal success message and emails the existing owner (`ACCOUNT_EXISTS`); reset, magic-link and resend-verification always return the same message; login errors never say which part was wrong.
- `safeRedirectPath` allows only same-origin relative paths for `?next=`.

### Authorisation (`src/lib/auth/session.ts`)

- `getWorkspaceContext` never trusts the workspace cookie by itself: it looks the value up in `WorkspaceMember` for the current user and falls back to the first membership.
- Guards distinguish read (`requireWorkspace`), write (`requireWritableWorkspace`, rejects support sessions), admin (`requireWorkspaceAdmin`) and platform roles (`requireSuperAdmin`). Pages redirect; actions return `fail(...)`; route handlers return JSON 401/403.
- The edge proxy (`src/proxy.ts`) redirects cookie-less visitors away from `/app`, `/super-admin` and `/onboarding` purely as a shortcut; it is documented as not being a security boundary.
- Suspended workspaces are blocked (`/app/suspended`) except for super-admin support sessions.

### Tenant isolation (`src/lib/services/*`)

- Every tenant table carries `workspaceId`, and services look records up by `{ id, workspaceId }`, never by id alone.
- Uploads are bound to the uploading user and workspace at presign and finalise; quote attachments require the quote to belong to the workspace.
- AI catalogue matches are filtered to ids that belong to the workspace after every analysis.
- Account deletion transfers shared workspaces to another admin and removes solely-owned workspaces with their bucket objects.

### Customer quote links (`src/lib/services/public-quote.ts`)

- Token = HMAC-SHA256(`BETTER_AUTH_SECRET:quote-link`, `<quoteId>:<version>`), base64url (43 characters, 256 bits of secret-derived entropy). The database stores only `sha256(token)`; a database leak does not yield working links.
- Links expire after `app.publicLinkValidityDays` (default 180) and can be rotated (`rotatePublicLink` bumps `publicTokenVersion`, adds a timeline event, and the old link stops resolving as soon as the new hash is stored).
- Lookups additionally require the quote to be undeleted, in a sent state (`SENT`, `VIEWED`, `ACCEPTED`, `DECLINED`, `EXPIRED`), and the workspace to be `ACTIVE`.
- Viewing is rate limited per IP; the business's own logged-in members are not counted as customer views; repeat views are de-duplicated with a per-quote, `httpOnly`, path-scoped viewer cookie; IPs are stored only as salted hashes.
- Accept/decline requires the `customer_acceptance` flag, an open quote, a typed name and terms confirmation; the decision is recorded inside a transaction that re-checks the status, locks the version and stores the total at that moment.
- The public page and PDF are `noindex`; `/q/` is disallowed in `robots.txt`.

### Files (`src/lib/storage/*`, `src/lib/services/uploads.ts`)

See [STORAGE.md](STORAGE.md): private bucket, 5-minute presigned URLs, random keys with no user-supplied names, policy checks before presign (type, size, extension), size re-check after upload, image re-encoding with metadata stripping, authenticated proxy route with `nosniff`, local signed URLs verified with `timingSafeEqual`.

### Billing (`src/lib/billing/*`, `src/app/api/webhooks/stripe/route.ts`)

- Raw-body signature verification; 400 on failure with an `ApplicationError` record.
- Events processed exactly once via `StripeWebhookEvent`; failures return 500 so Stripe retries.
- The client never sets plan state: Checkout only redirects, and the subscription row changes from webhooks or an admin's audited action.
- Credit consumption is transactional and idempotent; allowance increments use a conditional SQL update so concurrent requests cannot exceed the limit.

### AI (`src/lib/ai/*`)

- All model output passes Zod validation before storage; the schemas contain no price fields, and the pricing engine ignores the model entirely.
- Prompts instruct the model never to invent prices or certify hidden conditions; photographs are described with caveats.
- Requests use `store: false`; the API key is only in server memory; cost and tokens are recorded per run.
- Enquiry text, transcripts and images are sent to OpenAI for processing; this is disclosed in the privacy policy copy and should stay disclosed.

### Browser hardening (`src/proxy.ts`, `src/lib/security/headers.ts`)

Applied to every non-static response:

- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'nonce-<per request>' 'strict-dynamic'` (+ Stripe hosts, `'unsafe-eval'` only in development); `style-src 'self' 'unsafe-inline'` (required by Tailwind/inline styles); `img-src`/`media-src` `'self' blob: data: https:`; `connect-src 'self'` + Stripe + `https:` (direct-to-bucket uploads); `frame-src` Stripe only; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `upgrade-insecure-requests` in production.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in production.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera and microphone self-only for voice/photo capture, geolocation and USB disabled), `Cross-Origin-Opener-Policy: same-origin`, `X-DNS-Prefetch-Control: off`.
- `poweredByHeader: false`; the only `dangerouslySetInnerHTML` is the JSON-LD script, rendered with the CSP nonce from server data.
- User-supplied Markdown (email templates, marketing content) is parsed by `src/lib/utils/safe-markdown.ts`, which supports a small subset, escapes everything and allows only `http(s)`, `mailto:` and same-origin hrefs.
- CSV exports escape values and neutralise spreadsheet formula injection (`src/lib/utils/csv.ts`).

### Platform administration (`src/app/super-admin/**`)

- Every action requires a reason where it affects a customer (suspend, role change, credits, complimentary plan, delete) and is written to `AdminAuditLog` with previous/new values and a hashed IP.
- Support mode is read-only, expires after two hours, is visible to the admin in a banner and is audited at start and end ([SUPER_ADMIN.md](SUPER_ADMIN.md)).
- The console and the deep health check are `SUPER_ADMIN` only; the public health check exposes no configuration.

### Configuration and deployment

- `src/lib/env.ts` validates every variable at start-up and refuses production with mock AI, preview email, mock billing, local/in-memory storage or a non-HTTPS `APP_URL`.
- Secrets are read from the environment only; the Docker build uses placeholders and never embeds secrets; the container runs as a non-root user.
- Errors shown to users are generic in production (`toUserMessage` returns internal messages only outside production); details go to `ApplicationError`.
- Rate limits, sessions and locks live in PostgreSQL so they hold across replicas.

## What is never exposed

- Raw passwords (hashed by Better Auth), API keys, the auth secret or bucket credentials: none are logged, returned by any route or rendered in any page, including `/api/health/system` which reports only provider names and check messages.
- Working customer quote tokens, invitation tokens or local signed-URL secrets: only SHA-256 hashes are stored (`Quote.publicTokenHash`, `WorkspaceInvite.tokenHash`).
- Raw IP addresses: `hashIp` stores a truncated salted hash on quote events, acceptances, contact submissions and audit rows.
- Photo metadata (EXIF, GPS, device details): stripped on upload.
- One workspace's data to another workspace's members, or unclaimed onboarding uploads to anyone but the uploader.
- Whether an email address is registered (sign-up, reset, magic-link and verification flows answer identically).
- Enquiry text, quote wording or other content in `ApplicationEvent` properties (identifiers and numbers only).
- Internal cost and margin figures to customers: the public document model (`buildQuoteDocument`) is customer-safe and is the only source for the public page and PDF.
- Stack traces or internal error messages to end users in production.

## Rate limits

Fixed-window limits stored in `RateLimitBucket` (`src/lib/security/rate-limit.ts`, `RATE_LIMITS`), enforced via `enforceRateLimit` (throws HTTP 429) or `checkRateLimit`. Buckets older than a day are removed by the cron runner.

| Key | Limit | Window | Identifier | Applied in |
| --- | --- | --- | --- | --- |
| `registration` | 5 | 10 min | IP | `signUpAction` |
| `login` | 10 | 10 min | IP + email | `signInAction` |
| `passwordReset` | 5 | 15 min | IP (`verify:` prefix for resend-verification) | forgot password, resend verification |
| `magicLink` | 5 | 15 min | IP | magic-link request |
| `aiGeneration` | 20 | 10 min | workspace | transcription, analysis, wording, section regeneration |
| `publicQuote` | 60 | 5 min | IP | `/q/[token]` page and PDF |
| `publicQuoteDecision` | 10 | 10 min | IP | accept/decline action |
| `contactForm` | 3 | 15 min | IP | marketing contact form (plus honeypot) |
| `emailSend` | 30 | 1 h | workspace | sending a quote |
| `presign` | 60 | 10 min | user | `POST /api/uploads/presign` |
| `invite` | 20 | 1 h | workspace | team invitations |
| `export` | 10 | 1 h | user | personal data export |
| `demoReset` (ad hoc rule) | 3 | 10 min | IP | `/demo` reset button |

Better Auth additionally applies its own limit of 60 requests per 60 seconds on `/api/auth/*`. Unknown scopes default to 30 per minute.

## Operational recommendations

- Rotate `BETTER_AUTH_SECRET`, API keys and bucket credentials on change of ownership (see [HANDOVER.md](HANDOVER.md)); rotating the auth secret invalidates sessions and outstanding customer links.
- Keep Railway backups enabled; test a restore.
- Watch `ApplicationError`, failed `StripeWebhookEvent`s and `EmailEvent` failures from the super-admin overview.
- Keep dependencies current (`pnpm outdated`, `pnpm audit`); the project pins exact versions of `next`, `react`, `prisma` and `typescript`.
- There is no CI in the repository; run `pnpm lint`, `pnpm typecheck` and `pnpm test` before deploying.

## Reporting a vulnerability

There is no dedicated security contact built into the product. Reports should go to the support address configured in the `branding.supportEmail` site setting (shown on the marketing site and in every email), or to the repository owner directly. The new owner is encouraged to publish a `security.txt` at `/.well-known/security.txt` and a security page once they take over. Please include reproduction steps and do not access other users' data while testing; use a self-registered account and the `/demo` workspace.
