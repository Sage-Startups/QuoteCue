# Super-admin console

The platform console lives at `/super-admin` (`src/app/super-admin/**`, shared UI in `src/components/admin/*`). It is available only to users whose `platformRole` is `SUPER_ADMIN`; the layout calls `requireSuperAdminForPage` and every action and route handler re-checks the role server-side (`adminAction`, `superAdminForRoute` in `_lib/admin.ts`). The console is excluded from search engines (`robots: noindex`, `/super-admin` disallowed in `robots.ts`).

## Promoting an administrator

Roles are never granted through the UI to someone who has not registered. Create a normal account first (sign up, verify the email address), then either:

```bash
pnpm admin:promote --email you@example.com              # SUPER_ADMIN (default)
pnpm admin:promote --email you@example.com --role SUPPORT_ADMIN
pnpm admin:promote --email you@example.com --role USER   # demote
```

or set `SUPER_ADMIN_EMAIL` and run `pnpm db:seed`, which promotes that address if the account already exists. Both paths write an `AdminAuditLog` entry (`admin.promote`, actor `cli` or `seed`). A super admin can also change roles from the Users page (reason required, audited). Deleting the last remaining super admin is refused (`requireNotLastSuperAdmin`). In production, run the promote command from a Railway shell or from a local checkout whose `DATABASE_URL` points at the production database (see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md), step 18).

Platform roles:

| Role | Effect |
| --- | --- |
| `USER` | Normal account |
| `SUPPORT_ADMIN` | Passes `requireSupportAdmin()`; reserved for a limited support console (no pages use it yet) |
| `SUPER_ADMIN` | Full console, `/api/health/system`, site-asset uploads, support sessions |

## What is implemented in this build

`src/components/admin/admin-nav.ts` defines nineteen sections: Overview, Users, Workspaces, Subscriptions, Plans and credits, Quotes, AI usage, Storage, Email activity, Marketing content, Trade templates, AI prompts, Feature flags, Site settings, Branding, System health, Background jobs, Webhooks and Audit log. Every section has a page under `src/app/super-admin/**`; the sections that change data have a co-located `actions.ts`.

Conventions shared by all sections (`_lib/admin.ts`):

- Lists show 25 rows per page (`PAGE_SIZE`) and keep their search and filter parameters in the query string.
- Lists of tenant data carry an **Exclude demo** toggle (`?excludeDemo=0` includes the Northstar demo workspace; it is excluded by default).
- CSV exports are route handlers under `<section>/export` guarded by `superAdminForRoute`; they apply the same filters as the page and are capped at 5,000 rows (10,000 for AI runs).
- Server actions run inside `adminAction`, which re-checks the role and converts thrown errors into a result object, and record every change with `adminAudit` (actor id and email, action, target, reason, before/after values as JSON and a salted hash of the client IP). Form input is validated with Zod; where a reason is required it must be 5 to 500 characters.
- Stripe identifiers are masked to their last six characters (`maskId`) on pages and in exports.

### Overview (`/super-admin`)

Platform statistics for a selectable date range (`?range=7d|30d|90d|custom&from&to`) with a comparison to the previous period, and an **Exclude demo** toggle (`?excludeDemo=0` includes the Northstar demo workspace; excluded by default). `_lib/overview-stats.ts` computes:

- users registered / verified / active, workspaces created;
- paid subscriptions started and cancelled, churn against the opening base, credit packs sold and their estimated value;
- quotes created, sent, viewed and accepted;
- AI runs, successes, failures and estimated cost (`AiRun.estimatedCostMicros`, `PROMPT_TEST` excluded), cost per successful run;
- emails sent and failed;
- a current snapshot: total users, verified, suspended, workspaces, trialling workspaces, stored bytes and objects, failed Stripe webhook events, and the last cron heartbeat (flagged stale after 26 hours).

### Users (`/super-admin/users`)

List with search and filters (role, verified, suspended), pagination (25 per page) and a CSV export (`/super-admin/users/export`, up to 5,000 rows). The detail page (`/super-admin/users/[id]`) shows the account, its workspace memberships and recent audit entries, and offers these actions (all in `users/actions.ts`, wrapped by `adminAction` and recorded with `adminAudit`):

| Action | Audit action | Notes |
| --- | --- | --- |
| Suspend | `user.suspend` | Reason required (5–500 characters); sets `suspendedAt`, revokes all sessions; the sign-in hook refuses suspended users. Cannot suspend yourself |
| Restore | `user.restore` | Clears the suspension |
| Revoke sessions | `user.sessions.revoke` | Deletes every `Session` row |
| Send password reset | `user.password_reset.send` | Uses Better Auth's reset flow and the `PASSWORD_RESET` template |
| Change role | `user.role.change` | `USER`, `SUPPORT_ADMIN`, `SUPER_ADMIN`; reason required |
| Grant credits | `workspace.credits.grant` | Adds or removes AI credits on one of the user's workspaces through `grantCredits` (types `ADMIN_GRANT`, `PROMOTIONAL`, `ADJUSTMENT`); reason required; the ledger entry names the admin |
| Apply complimentary plan | `subscription.complimentary.apply` | Sets the workspace subscription to `COMPLIMENTARY` on a chosen plan until a date, with the reason stored on the subscription |
| Delete user | `user.delete` | Runs `deleteUserAccount`: solely-owned workspaces are deleted with their files, shared ones transferred to another admin; refuses the last super admin |

Every audit row stores actor id and email, action, target, reason, before/after values as JSON and a salted hash of the client IP (never the raw address).

### Workspaces (`/super-admin/workspaces`)

List of non-deleted workspaces with search (name, slug or owner email), a status filter (`ACTIVE`, `SUSPENDED`, `PENDING_DELETION`), the demo toggle, pagination and a CSV export (`/super-admin/workspaces/export`: owner, status, plan, subscription status and period end, members, quotes, credit balance, deletion request date).

The detail page (`/super-admin/workspaces/[id]`) shows business settings, owner and counts (customers, catalogue items, quote templates), the plan with its entitlement badges, quotas (AI allowance used this period, credit balance, members, storage against the plan allowance), quote counts by status with accepted value, the member list with roles and last login, the five most recent support sessions, the last 30 audit entries targeting the workspace, and a danger zone. **Export data (JSON)** (`/super-admin/workspaces/[id]/export`) downloads the whole workspace (settings, members, customers, catalogue, quote templates, quotes with versions, items, events, acceptances and media, subscription, invoices, credit ledger and usage records) and is audited as `workspace.export`.

Actions (`workspaces/actions.ts`):

| Action | Audit action | Notes |
| --- | --- | --- |
| Suspend | `workspace.suspend` | Reason required; refused for the demo workspace and for a workspace that is already suspended; stores `suspendedReason` |
| Restore | `workspace.restore` | Only for suspended workspaces |
| Grant promotional credits | `workspace.credits.grant` | Amount 1 to 500, reason required; `grantCredits` with type `PROMOTIONAL`; the ledger reason names the admin |
| Start deletion | `workspace.deletion.start` | Reason required and the slug must be typed to confirm; sets `PENDING_DELETION` and `deletionRequestedAt` so members lose access while data is retained; refused for the demo workspace |
| Cancel deletion | `workspace.deletion.cancel` | Returns a pending workspace to `ACTIVE` |
| Delete now | `workspace.delete` | Reason required and the slug must be typed; runs `deleteWorkspaceCompletely`; the audit entry keeps a snapshot (name, slug, owner, status, member, quote and object counts); refused for the demo workspace |

The **Support mode** card on this page starts a support session (see [Support mode](#support-mode)).

### Subscriptions (`/super-admin/subscriptions`)

List with search (workspace name, owner email, Stripe customer or subscription id), filters for status (`TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `UNPAID`, `INCOMPLETE`, `INCOMPLETE_EXPIRED`, `PAUSED`, `COMPLIMENTARY`) and plan, the demo toggle, pagination and a CSV export (`/super-admin/subscriptions/export`).

The detail page (`/super-admin/subscriptions/[workspaceId]`) shows the locally synchronised Stripe state (plan, status, interval, period, cancellation, trial and complimentary dates, masked Stripe ids, last sync, credit balance), a link to the customer in the Stripe dashboard (test or live, chosen from `APP_URL`), the last 50 invoices with hosted invoice links, the last 50 credit ledger entries and the `subscription.*` audit history. When Stripe is not configured the page says billing is in mock mode and the Stripe actions are disabled.

Actions (`subscriptions/actions.ts`, plus the complimentary form shared with Users):

| Action | Audit action | Notes |
| --- | --- | --- |
| Change plan mapping | `subscription.plan.change` | Reason required; target must be a `SUBSCRIPTION` plan; only the local `planId` changes, Stripe is not modified (for correcting mismatches) |
| Cancel at period end / Restore | `subscription.cancel_at_period_end` / `subscription.restore` | Calls `setCancelAtPeriodEnd`, which updates Stripe |
| Reconcile with Stripe | `subscription.reconcile` | Runs `reconcileSubscription`; disabled without a Stripe key or a real Stripe subscription; the result message is stored in the audit entry |
| Complimentary entitlement | `subscription.complimentary.apply` | Same action as on the Users page |

### Plans and credits (`/super-admin/plans`)

One form per `Plan`, grouped into subscription plans and credit packs, with the number of subscriptions on each. `savePlanAction` (audit `plan.update`, previous and new values recorded) edits name (1 to 80 characters), description (up to 400), monthly, annual and one-time prices (decimals with at most two places, stored in minor units), AI generations per period, credits granted, maximum members, storage allowance in MB, feature bullets (one per line), the three Stripe price ids, active, public and highlighted flags, sort order and the `PlanEntitlement` set (rows not ticked are deleted). Stripe price ids must look like `price_...`; when Stripe is configured each id is verified with `prices.retrieve` before saving, otherwise only the format is checked. Saving revalidates `/pricing` and `/app/billing`; changes apply to new checkouts, existing Stripe subscriptions keep their Stripe price. Plans cannot be created or deleted from the console.

### Quotes (`/super-admin/quotes`)

Cross-tenant list showing metadata only (number, title, workspace, status, total, created, sent and expiry dates) with search (number, title, workspace name or slug), a status filter, the demo toggle, pagination and a metadata-only CSV export (`/super-admin/quotes/export`; no enquiry text, notes or wording).

The detail page (`/super-admin/quotes/[id]`) always shows metadata and dates (customer, creator, version, totals, view count, public-link state). Enquiry text, job notes, voice transcript, internal notes, the stored AI analysis and the rendered quote document (without the business logo) are hidden behind **Reveal private content**. `viewPrivateQuoteAction` (`quotes/actions.ts`) requires a reason, records `quote.support_view` and writes a `QuoteEvent` of type `SUPPORT_ACCESS` (actor type `ADMIN`, the reason as the message) so the workspace sees the access in the quote's activity. The content is then unlocked for that admin for 30 minutes (`SUPPORT_VIEW_WINDOW_MS`; the page checks for a `quote.support_view` audit entry by the same admin within the window). The page lists the last ten support accesses.

### AI usage (`/super-admin/ai-usage`)

Date range and demo toggle. Totals for the period: runs (with the number still running), succeeded and failed with rates, estimated cost and cost per billable generation, input and output tokens, minutes of audio transcribed and billable generations (successful `ENQUIRY_ANALYSIS` and `QUOTE_WORDING` runs). Charts of runs and estimated cost per day, tables by feature and by model and provider, the twenty workspaces with the most runs, and the 25 most recent failed runs with error category and message. **Export runs CSV** (`/super-admin/ai-usage/export`) returns up to 10,000 `AiRun` rows for the range. No actions.

### Storage (`/super-admin/storage`)

Live bytes and object count, pending uploads, soft-deleted objects awaiting clean-up and the active storage provider; usage by purpose; platform-wide daily snapshots (`StorageUsageSnapshot` rows without a workspace) for the last 90 days; and the fifteen largest workspaces compared with their plan allowance. No filters, export or actions.

### Email activity (`/super-admin/emails`)

Stat cards for a selectable date range (sent or delivered, failed, preview, skipped, with delivery rate). The list below is filtered by search (recipient or subject), kind and status (`QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `PREVIEW`, `SKIPPED`), is paginated and links each event to its workspace and quote; events with a stored `htmlPreview` (preview provider in development) can be rendered inline. CSV export at `/super-admin/emails/export`. No actions on events.

**Email templates** (`/super-admin/emails/templates`) lists every `EmailKind` with its subject, whether it is customised or the built-in default, and whether it is enabled. The editor (`/super-admin/emails/templates/[kind]`) edits name, subject, preview text, Markdown body and the enabled flag, with a live preview rendered with sample variables and the current branding. Actions (`emails/templates/actions.ts`):

| Action | Audit action | Notes |
| --- | --- | --- |
| Save | `email_template.update` | Name 1 to 80, subject 1 to 200, preview text up to 200, body 1 to 20,000 characters; any `{{variable}}` outside the template's allowed set (its own variables plus `productName`, `supportEmail`, `appUrl`) is rejected |
| Reset to default | `email_template.reset` | Deletes the `EmailTemplate` row so the built-in default applies |
| Preview | none | Renders the unsaved fields; nothing is stored |
| Send test | `email_template.test_send` | Sends the unsaved fields to the admin's own address with sample variables (recorded as a normal `EmailEvent`); in preview mode nothing is delivered |

### Marketing content (`/super-admin/marketing`)

One row per key in `marketingSchemas` (homepage sections, pricing, about, contact, footer, per-page SEO, testimonials) showing whether it is customised. The editor (`/super-admin/marketing/[key]`) is a structured form generated from the stored value. `saveMarketingContentAction` (audit `marketing.update`) validates the submitted JSON against the section's Zod schema, upserts `MarketingContent`, invalidates the cache and revalidates the site, so the change is live immediately. `resetMarketingContentAction` (audit `marketing.reset`) deletes the row so the default copy applies. The testimonials section warns that only real, permitted quotes may be published; new testimonials are unpublished until ticked.

### Trade templates (`/super-admin/trade-templates`)

List ordered by sort order with service count and active state. `/super-admin/trade-templates/new` creates a template and `/super-admin/trade-templates/[slug]` edits one. `createTradeTemplateAction` (audit `trade_template.create`) and `updateTradeTemplateAction` (audit `trade_template.update`) share one schema: slug 2 to 60 lowercase letters, digits and dashes and unique on create; name 1 to 80; description up to 400; icon up to 40; sort order 0 to 1000; default scope and terms up to 4,000 characters; exclusions, questions and assumptions one per line; up to 100 suggested services, each with a name (up to 140), category, unit (`HOUR`, `DAY`, `ITEM`, `METRE`, `SQUARE_METRE`, `VISIT`, `FIXED`), kind (`LABOUR`, `MATERIAL`, `OTHER`), unit price and internal cost as decimals, and an optional customer description (up to 600). Saving revalidates `/templates`. Templates are deactivated rather than deleted.

### AI prompts (`/super-admin/prompts`)

The index shows the AI provider in use, a warning when `ai.enabled` is off, a form for the `ai.*` site settings (enable switch, model overrides with the environment defaults as placeholders, cost assumptions; saved through `saveSettingsAction`, audit `setting.update`) and a card per editable feature (every `AiFeature` except `TRANSCRIPTION`) with its published version and the five most recent versions.

The feature page (`/super-admin/prompts/[feature]?v=<versionId>`) lists all versions with author and run count, shows the built-in default when no version exists, and offers a **Prompt tester**. Actions (`prompts/actions.ts`):

| Action | Audit action | Notes |
| --- | --- | --- |
| New version | `prompt.version.create` | Copies the latest version (or the built-in default) into a new unpublished version |
| Save version | `prompt.version.update` | System prompt and user template 1 to 20,000 characters, optional model name (letters, digits, dots, dashes, colons, up to 80), notes up to 1,000; published versions are read-only; `{{variables}}` outside the feature's list are rejected |
| Publish / Roll back | `prompt.publish` or `prompt.rollback` (when the target is older than the version it replaces) | Exactly one published version per feature; unsupported variables block publishing; new runs use the version immediately |
| Delete version | `prompt.version.delete` | Unpublished versions only; the prompt text is kept in the audit entry |
| Test | `prompt.test` | Sample input 1 to 8,000 characters; runs `runStructuredAi` with feature `PROMPT_TEST` and `promptTestSchema` against the selected version or the built-in default, returning free-text output, model, provider, token counts and estimated cost. The user template is appended for reference without variable substitution. No credits are consumed and the run is excluded from overview cost figures |

### Feature flags (`/super-admin/feature-flags`)

One switch per key in `FEATURE_FLAGS` with its description, whether the stored value overrides the default, and when it last changed. `toggleFeatureFlagAction` (audit `flag.update`, before and after values recorded) upserts the `FeatureFlag` row and invalidates the cache, so the change applies within seconds. A flag change can be reverted from the audit log.

### Site settings (`/super-admin/settings`)

Forms generated from the setting schemas for the `app.*` (registration, maintenance mode and message, trial credits, quote defaults, upload limits, currencies, tax labels, retention), `email.*`, `announcement.*` and `analytics.*` keys, with alerts when maintenance mode is on or registration is disabled. `saveSettingsAction` (audit `setting.update`, one entry per changed key with previous and new value) validates each value with its Zod schema (`parseSettingValue`), skips unchanged keys, upserts `SiteSetting`, invalidates the cache and revalidates the whole site. `branding.*` and `seo.*` keys are edited on the Branding page and `ai.*` keys on the AI prompts page using the same action.

### Branding (`/super-admin/branding`)

Identity and colours (product name, tagline, company details, support email, colours, social links), brand assets and default SEO. Logo, favicon and social image are uploaded through the normal upload flow with purpose `SITE_ASSET`, stored as public objects served from `/api/files/<id>`, and referenced by `branding.logoObjectId`, `branding.faviconObjectId` and `branding.socialImageObjectId`; **Remove** clears the id so the built-in files in `public/brand` are used. Saves go through `saveSettingsAction` (audit `setting.update`).

### System health (`/super-admin/system-health`)

Runs the checks on every load (`dynamic = "force-dynamic"`): database connectivity and applied migration count, storage provider, Stripe, OpenAI, email provider and the cron heartbeat (stale after 26 hours), each with latency. Mock and preview providers are shown as warnings rather than failures. The page also lists the provider modes derived from the environment (never secrets) and the application error log (counts for 24 hours, 7 days and all time; the 20 most recent errors with stack and metadata). **JSON endpoint** opens `/api/health/system`, which returns the same checks.

### Background jobs (`/super-admin/jobs`)

Cron heartbeat status (stale after 26 hours), the latest run per job name, and a paginated list of `BackgroundJobRun` rows grouped by run id with search (run id, host or error) and filters for job name and status (`RUNNING`, `SUCCEEDED`, `FAILED`, `SKIPPED`); each run shows duration, host, error and result JSON. No actions or export ([RAILWAY_CRON.md](RAILWAY_CRON.md)).

### Webhooks (`/super-admin/webhooks`)

Stripe webhook events with total and failed counts, search (event type, Stripe event id or error), a status filter (`RECEIVED`, `PROCESSED`, `FAILED`, `IGNORED`), pagination, a payload summary per event and a CSV export (`/super-admin/webhooks/export`). **Retry processing** (`retryWebhookAction`, audit `webhook.retry`) fetches the event again from Stripe, resets the row to `RECEIVED` and runs `processStripeEvent`; it is disabled when Stripe is not configured.

### Audit log (`/super-admin/audit-log`)

Every `AdminAuditLog` entry with filters for action (substring), actor email (substring), target type and date range, pagination, expandable previous and new values, and a CSV export (`/super-admin/audit-log/export`). Entries whose action is `setting.update`, `marketing.update` or `flag.update` and that carry a previous value offer **Roll back** (`rollbackAuditEntryAction`), which re-applies the previous value through the same validated helpers in `_lib/apply.ts` and records `setting.update.rollback`, `marketing.update.rollback` or `flag.update.rollback` with the original entry id as the reason.

## Support mode

Support mode lets a super admin see a customer workspace exactly as the customer does, **read-only**, with a reason and an expiry.

- The **Support mode** card on the workspace detail page (`/super-admin/workspaces/[id]`, `panels.tsx`) has a reason field (5 to 500 characters) and an **Open in support mode** button that submits `startSupportSessionAction` (`src/app/super-admin/support-actions.ts`). The action ends any other open session for that admin, creates a `SupportSession` valid for **two hours**, records `support.session.start` in the audit log, sets the `quotecue.workspace` cookie to the target workspace and redirects to `/app`. A missing or short reason redirects back to the workspace page with an error.
- `getWorkspaceContext` recognises an unexpired, un-ended `SupportSession` for the cookie's workspace and returns a context with `supportSession` populated instead of a membership. Every write guard (`requireWritableWorkspace`, `requireWorkspaceRole`, `requireWorkspaceAdmin`) throws "Support mode is read-only", the upload routes reject the session, and pages render their read-only variants.
- The app shell shows an amber banner "Support mode (read-only): viewing <workspace>. Reason: ..." with an **End support session** button (`endSupportSessionAction`, audited as `support.session.end`, which clears the cookie and returns to the Workspaces list). Sessions that are not ended explicitly are closed by the `cleanup-sessions` job once they expire. The workspace page lists the five most recent sessions with their reasons.

Viewing an individual quote's private content is separate from support mode: `viewPrivateQuoteAction` on the quote detail page records `quote.support_view` and writes a `QuoteEvent` of type `SUPPORT_ACCESS` (shown with its own icon in the workspace's activity feed), then unlocks the content for 30 minutes.

## Maintenance mode

The `app.maintenanceMode` site setting is enforced by `MaintenanceGate` (`src/components/shared/maintenance-gate.tsx`), mounted in the root layout. When it is on, visitors see a maintenance page with the `app.maintenanceMessage` text and the support email. Signed-in super admins, the console (`/super-admin`), API routes (`/api/`) and the sign-in routes (`/login`, `/forgot-password`, `/reset-password`, `/magic-link`, `/verify-email`) stay open, so an administrator can always switch it off again from Site settings, which shows a warning while it is on.

## Backing data

The console pages above edit the following tables. Editing them with SQL, `pnpm prisma studio` or a script is an alternative (for example from a Railway shell when the console is unreachable); changes made that way are picked up within 15 seconds because the config loaders cache for that long, but they bypass validation and the audit log.

| Section | Backing data | Where it is used |
| --- | --- | --- |
| Workspaces | `Workspace`, `WorkspaceMember`, `BusinessSettings`, `SupportSession` | Tenant status (`ACTIVE`, `SUSPENDED`, `PENDING_DELETION`), support mode |
| Subscriptions | `Subscription`, `BillingInvoice`, `CreditLedgerEntry`, `UsageRecord` | [STRIPE.md](STRIPE.md); `reconcileSubscription` re-syncs a workspace from Stripe |
| Plans and credits | `Plan`, `PlanEntitlement` | Prices shown on `/pricing`, allowances, Stripe price ids (database values override the environment) |
| Quotes | `Quote`, `QuoteVersion`, `QuoteEvent` | Cross-tenant search |
| AI usage | `AiRun` | Tokens, cost, failures by category |
| Storage | `StoredObject`, `StorageUsageSnapshot` | Usage per workspace |
| Email activity | `EmailEvent`, `EmailTemplate` | Delivery status, errors, preview HTML in development; per-kind templates |
| Marketing content | `MarketingContent` | Homepage, pricing, about, contact copy and per-page SEO (`src/lib/config/marketing-content.ts`) |
| Trade templates | `TradeTemplate` | Onboarding starter catalogues and `/templates` |
| AI prompts | `AiPromptVersion` | One published version per feature ([AI_CONFIGURATION.md](AI_CONFIGURATION.md)) |
| Feature flags | `FeatureFlag` | `voice_recording`, `photo_analysis`, `email_sending`, `customer_acceptance`, `team_accounts`, `advanced_analytics`, `magic_link_login`, `experimental` |
| Site settings | `SiteSetting` | Keys and defaults in `src/lib/config/site-settings.ts` (branding, SEO, registration switch, maintenance mode, trial credits, upload limits, retention, link validity, demo reset interval, email sender details, AI switch/models/cost rates, announcement banner) |
| Branding | `SiteSetting` `branding.*` + `SITE_ASSET` uploads | Logo, favicon, social image, colours, company details |
| System health | `GET /api/health/system`, `ApplicationError` | JSON with database (migration count), storage, Stripe, OpenAI, Resend and cron heartbeat checks with latencies; the page runs the same checks |
| Background jobs | `BackgroundJobRun` | [RAILWAY_CRON.md](RAILWAY_CRON.md) |
| Webhooks | `StripeWebhookEvent` | Status `RECEIVED`, `PROCESSED`, `IGNORED`, `FAILED` with error text |
| Audit log | `AdminAuditLog` | Every admin and CLI change |

Example: switch off customer acceptance platform-wide without the console.

```sql
UPDATE "FeatureFlag" SET enabled = false WHERE key = 'customer_acceptance';
```

Example: change the number of trial generations for new workspaces.

```sql
INSERT INTO "SiteSetting" (id, key, value, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'app.trialCredits', '5', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW();
```

Values are stored as JSON and validated against the Zod schema on read; an invalid value is ignored and the default applies.

## Environment badge

The console header shows the running environment (`production` or the `NODE_ENV` value) so that a test deployment is never mistaken for the live one.
