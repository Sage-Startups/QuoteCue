# Billing with Stripe

Billing is implemented in `src/lib/billing/*` (plans, entitlements, credits, Stripe client) and exposed through `/app/billing` (Server Actions in `src/app/app/billing/actions.ts`) and the webhook route `src/app/api/webhooks/stripe/route.ts`. Stripe is called only from the server; the browser only ever follows redirects to Stripe-hosted Checkout and Billing Portal pages.

## Plans

The seeded catalogue (`src/lib/billing/plans.ts`, written to `Plan`/`PlanEntitlement` by `pnpm db:seed`) is:

| Plan (`PlanKey`) | Price | AI generations | Users | Storage allowance | Entitlements |
| --- | --- | --- | --- | --- | --- |
| Free trial (`FREE`) | $0, no card | 3 credits granted at onboarding (`app.trialCredits`) | 1 | 250 MB | PDF downloads (with QuoteCue branding), acceptance links, basic analytics |
| Starter (`STARTER`) | $19/month or $190/year | 25 per billing period | 1 | 2 GB | + custom logo, remove branding, CSV export |
| Pro (`PRO`) | $39/month or $390/year | 100 per billing period | 5 | 10 GB | + full branding, advanced analytics, custom templates, team accounts, priority support |
| 5 extra AI generations (`CREDIT_PACK_5`) | $9 one-off | 5 credits, never expire | — | — | works with any plan |

Prices are stored in USD minor units (`monthlyPriceMinor`, `annualPriceMinor`, `oneTimePriceMinor`) and shown on `/pricing` and `/app/billing` from the database (`getPublicPlans`). **Stripe remains the source of truth for what is charged**: the amounts on the Stripe prices must match what the plan rows display. The seed is create-only for existing plan rows, so edits made in the database survive re-seeding. Entitlement keys are listed in `ENTITLEMENT_KEYS`: `CUSTOM_LOGO`, `REMOVE_BRANDING`, `FULL_BRANDING`, `PDF_DOWNLOAD`, `ACCEPTANCE_LINKS`, `BASIC_ANALYTICS`, `ADVANCED_ANALYTICS`, `CUSTOM_TEMPLATES`, `PRIORITY_SUPPORT`, `TEAM_ACCOUNTS`, `CSV_EXPORT`.

## Stripe configuration

1. Create two products, **Starter** and **Pro**, each with a monthly and an annual recurring price, and one product **5 extra AI generations** with a one-off price. Use test mode first.
2. Put the price ids in the environment (or in the plan rows, see below):

   ```dotenv
   STRIPE_SECRET_KEY=sk_live_...            # sk_test_... in development
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
   STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
   STRIPE_PRO_MONTHLY_PRICE_ID=price_...
   STRIPE_PRO_ANNUAL_PRICE_ID=price_...
   STRIPE_CREDIT_PACK_PRICE_ID=price_...
   ```

3. Register a webhook endpoint at `https://<your domain>/api/webhooks/stripe` subscribed to the events listed under *Webhooks* and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

`resolvePriceId(planKey, interval)` looks first at `Plan.stripeMonthlyPriceId` / `stripeAnnualPriceId` / `stripeOneTimePriceId` and falls back to the environment variables; `planForPrice` does the reverse when a webhook arrives. Storing ids on the plan rows therefore lets you change prices without a redeploy.

Production refuses to start without `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (`src/lib/env.ts`). `stripeHealthCheck` (System health) retrieves the balance and reports whether the key is live or test mode.

## Checkout

`startCheckoutAction` (workspace admins only) calls `createCheckoutSession`:

- records a `checkout_started` application event;
- creates or reuses a Stripe customer per workspace (`Subscription.stripeCustomerId`, customer metadata `workspaceId`);
- creates a Checkout Session in `subscription` mode for Starter/Pro or `payment` mode for the credit pack, with `client_reference_id` and metadata `{ workspaceId, planKey, interval, userId }` (also copied onto the subscription or payment intent), `allow_promotion_codes: true`, success URL `/app/billing?checkout=success&session_id=...` and cancel URL `/app/billing?checkout=cancelled`;
- redirects the browser to the Stripe-hosted page.

The subscription state is **not** changed by the redirect back; it changes when the webhook arrives. The billing page therefore says "Your plan updates as soon as Stripe confirms it."

`openPortalAction` creates a Billing Portal session (`return_url` `/app/billing`) where customers manage payment methods, invoices and cancellation. `cancelSubscriptionAction` toggles `cancel_at_period_end` through the API and syncs the result.

## Webhooks

`POST /api/webhooks/stripe` reads the raw body, verifies the `stripe-signature` header with `STRIPE_WEBHOOK_SECRET` (`stripe.webhooks.constructEvent`) and returns 400 on a bad signature (recorded in `ApplicationError` as `stripe.webhook.signature`). It returns 503 when Stripe is not configured.

`processStripeEvent` upserts a `StripeWebhookEvent` row keyed by the Stripe event id **before** processing; an event whose row is already `PROCESSED` is answered as `DUPLICATE` without side effects, so Stripe retries are safe. Handled events:

| Event | Handling |
| --- | --- |
| `checkout.session.completed` | `payment` mode with a credit-pack `planKey`: `grantCredits` (`PACK_PURCHASE`, idempotency key `stripe:checkout:<session id>`) and a `credit_pack_purchased` event. `subscription` mode: retrieves the subscription and runs `syncSubscriptionFromStripe` |
| `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` | `syncSubscriptionFromStripe` |
| `invoice.paid`, `invoice.payment_succeeded`, `invoice.finalized` | `recordInvoice` upserts `BillingInvoice` (number, status, amounts, hosted URL, PDF URL, period) |
| `invoice.payment_failed` | records the invoice, sets `Subscription.status = PAST_DUE` with the failure message, emails the owner (`PAYMENT_FAILED`) |
| anything else | stored as `IGNORED` |

A handler exception marks the row `FAILED` with the error, logs `stripe.webhook.process` and returns HTTP 500 so Stripe retries. Failed rows are counted on the super-admin overview.

`syncSubscriptionFromStripe` maps the Stripe subscription onto the workspace's `Subscription` row: plan (from the price id), status (`active → ACTIVE`, `trialing → TRIALING`, `past_due → PAST_DUE`, `canceled → CANCELED`, `unpaid → UNPAID`, `incomplete`, `incomplete_expired`, `paused`), interval, period start/end from the first item, `cancelAtPeriodEnd`, `canceledAt`, `trialEndsAt`. Cancelled, expired or unpaid subscriptions are moved back to the `FREE` plan. The first transition into `ACTIVE`/`TRIALING` on a paid plan records `subscription_activated` and sends the `SUBSCRIPTION_CONFIRMED` email; a new cancellation records `subscription_cancelled`. A subscription without a `workspaceId` in metadata is matched by subscription id or customer id, otherwise logged and ignored.

### Local testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`, restart `pnpm dev`, and pay with card `4242 4242 4242 4242`. `stripe trigger checkout.session.completed` and friends exercise the handlers.

## Entitlements and usage

`getWorkspaceEntitlements(workspaceId)` (`entitlements.ts`) is the single source of truth for what a workspace may do:

- `ensureSubscription` creates a `FREE`/`TRIALING` subscription (30-day period) for any workspace that has none.
- `paidFeaturesActive` is true for `ACTIVE`, `TRIALING`, `PAST_DUE` (grace) and unexpired `COMPLIMENTARY` subscriptions. A lapsed paid plan falls back to the free feature set and one member.
- The current period is taken from Stripe for linked subscriptions, otherwise rolled forward from the subscription's anchor by month or year (`currentPeriodFor`).
- `allowancePerPeriod` is the plan's `aiGenerationsPerPeriod` (0 on the free plan); `usedThisPeriod` comes from `UsageRecord` (`AI_GENERATION`, unique per workspace/metric/period start); `creditBalance` is `Workspace.aiCreditBalance`; `totalAvailable = allowanceRemaining + creditBalance`.
- `features` is the map of entitlement keys to booleans; `maxMembers` is 1 unless a paid plan is active.

Enforcement points: `assertCanGenerate` before every credit-consuming AI call; `assertFeature("PDF_DOWNLOAD")` on the PDF route; `ACCEPTANCE_LINKS` when sending or copying a link; `CUSTOM_LOGO` when a logo is set; `CUSTOM_TEMPLATES` for a second template; `CSV_EXPORT` on quote and catalogue exports; `ADVANCED_ANALYTICS` on the analytics page; team size in `services/team.ts`. `EntitlementError` carries HTTP status 402 and an upgrade message.

## Credits and generations

`consumeGeneration` (`credits.ts`) runs in a transaction and is idempotent by key (`credit:<AiRun id>`):

1. If a ledger entry with the key exists, return `already_consumed`.
2. If the plan has a period allowance, increment `UsageRecord.count` with a conditional `INSERT ... ON CONFLICT ... WHERE count < allowance`; if a row was updated the generation came from the **allowance** (ledger entry with `delta 0`).
3. Otherwise decrement `Workspace.aiCreditBalance` where it is at least 1; if nothing was updated throw `EntitlementError`. Ledger entry with `delta -1` and the resulting balance.

`refundGeneration` reverses a consumption once (key `<key>:refund`) when a later step fails. `grantCredits` adds `TRIAL_GRANT`, `PACK_PURCHASE`, `ADMIN_GRANT`, `PROMOTIONAL` or `ADJUSTMENT` entries (negative adjustments cannot take the balance below zero) with an optional idempotency key. Every movement is visible in `CreditLedgerEntry` (`balanceAfter`, `reason`, `metadata.source`).

Only two operations consume a generation: enquiry analysis and full wording generation. Transcription and single-section regeneration are free but rate limited. When a trial workspace runs low, `TRIAL_LIMIT_WARNING` is emailed at most once per seven days and `trial_limit_reached` is recorded at zero.

## Mock billing (development only)

When `STRIPE_SECRET_KEY` is empty and `NODE_ENV` is not `production`:

- `createCheckoutSession` returns `/app/billing/mock-checkout?plan=...&interval=...`, a clearly labelled page whose button calls `completeMockCheckoutAction` → `mockActivateSubscription`, which activates the plan (fake `cus_mock_`/`sub_mock_` ids), writes a mock paid `BillingInvoice`, grants pack credits, and sends the confirmation email (to the preview inbox).
- `createPortalSession` returns `/app/billing/mock-portal`.
- `setCancelAtPeriodEnd` updates the row directly.
- The billing page shows "Mock checkout completed" and the portal button reads "Open mock billing portal".

All of these throw "Billing is not configured" or "Mock billing is disabled in production" when `NODE_ENV=production`, and `env.ts` refuses to start production without Stripe keys anyway.

## Operations

- **Reconcile a workspace**: `reconcileSubscription(workspaceId)` retrieves the linked subscription from Stripe and re-syncs it; useful after a missed webhook.
- **Complimentary access**: the super-admin Users page can set a workspace to `COMPLIMENTARY` on any plan until a date (audited).
- **Changing prices**: create new Stripe prices, update the `Plan` rows (`monthlyPriceMinor`, `annualPriceMinor`, `stripe*PriceId`) or the environment variables, and archive the old prices in Stripe. Existing subscriptions keep their old price until changed in Stripe.
- **Going live**: replace test keys with live keys, create the live webhook endpoint (new `whsec_`), and re-enter the live price ids. `stripeHealthCheck` shows "live mode" when done.
