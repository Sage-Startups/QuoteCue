# Ten-minute demo script

A walkthrough for showing QuoteCue AI to a buyer or a prospective customer. Part 1 (about three minutes) uses the public `/demo` experience, which needs no account and never calls a paid provider. Part 2 (about seven minutes) walks through the real application end to end.

## Before you start

- Run the app locally with `DEMO_MODE=true` (see [SETUP.md](SETUP.md)) or use a deployment with `DEMO_MODE=true`. Part 2 assumes a development environment: no `OPENAI_API_KEY` (mock AI), no `RESEND_API_KEY` (email previews at `/app/dev/emails`), no `STRIPE_SECRET_KEY` (mock checkout). Everything also works with real keys; only the "mock" labels disappear.
- Seed the database (`pnpm db:seed`) so plans, trade templates and the Northstar demo exist; run `pnpm demo:reset` if the demo has been played with.
- Have one account already verified and promoted (`pnpm admin:promote --email you@example.com`) for the super-admin part. For the sign-up part, prepare a second email address.
- Email verification for a **brand-new** account cannot be read from `/app/dev/emails` because that inbox needs a workspace; keep a database console ready for the query in step 8, or configure a real `RESEND_API_KEY` for the demo.
- Open the browser at 1440 px width, with a mobile emulation ready (375 px) for one quick responsive check.

## Part 1 — Public demo (`/demo`)

**1. Landing page (20 s).** Open `/`. Point out the positioning ("From enquiry to professional quote in minutes"), the three inputs (message, voice note, photos) and the "Explore the live demo" button. Optionally toggle the 375 px viewport to show the responsive header.

**2. Demo dashboard (40 s).** Open `/demo`. The banner explains that everything belongs to the fictional "Northstar Electrical Services". Show the four headline stats (created, sent, viewed, accepted), acceptance rate and value quoted/accepted, then the activity chart and the status pie. Change the date range (`90d` → `30d`) to show comparisons against the previous period. Mention that this is three months of relative-dated sample data that resets automatically.

**3. Create a quote in the demo (60 s).** Click **Create a quote** (`/demo/new-quote`). The four steps are Enquiry → Analysis → Pricing → Preview and nothing is saved:

- paste or keep the sample customer message ("2 double sockets ... hall light ... fuse box in the garage");
- run the analysis: show the readiness badge, the suggested work items matched to Northstar's catalogue with confidence and "requires confirmation", the customer questions and the safety notes; stress that the AI proposed *work*, not prices;
- on Pricing, adjust a quantity or unit price and watch the totals update (tax is calculated by the deterministic pricing engine);
- on Preview, show the finished customer document with scope, inclusions, exclusions, assumptions, payment terms and warranty.

**4. Quotes list and customer view (40 s).** Open `/demo/quotes`: filters by status, quote numbers `QC-YYYY-NNNN`, totals and dates. Open a sent quote, then **See the customer view** (`/demo/customer-view/<id>`): this is exactly what a customer receives, with the accept/decline controls disabled in the demo.

**5. Reset (10 s).** Click **Reset demo** in the header; the workspace is rebuilt in a few seconds (rate limited to three resets per ten minutes per IP). Close with: "Everything you just saw is the real product code running on sample data. Now the real thing."

## Part 2 — The real application

**6. Sign up (30 s).** Open `/signup` in a private window. Enter a name, the second email address and a password (10+ characters). Note the neutral success message.

**7. Verify (30 s).** In development the verification email is stored instead of sent. Read the link from the database:

```sql
SELECT "textPreview" FROM "EmailEvent" WHERE kind = 'VERIFY_EMAIL' ORDER BY "createdAt" DESC LIMIT 1;
```

Open the link: the account is verified, signed in automatically and redirected to onboarding. (With Resend configured, simply click the link in the email. After onboarding, every later email is visible at `/app/dev/emails`.)

**8. Onboarding (60 s).** Fill in the business name, choose a trade (twelve templates: electrician, plumber, builder, heating engineer, roofer, landscaper, joiner, painter and decorator, handyman, cleaning, property maintenance, general), currency, tax mode and rate, labour rate, call-out fee, payment terms, validity and brand colour; optionally upload a logo. Leave "include starter catalogue" and "create a sample quote" ticked. Submit: the workspace, business settings, default template, catalogue and three trial generations are created.

**9. Dashboard and catalogue (30 s).** Show the dashboard (empty stats, the sample quote, the "AI generations" usage indicator in the sidebar showing the three trial credits). Open **Catalogue** to show the trade-specific starter items with prices, units and internal costs, plus CSV import/export.

**10. The quote wizard (2 min).** Open the sample quote or click **New quote**. Walk the seven steps:

1. *Customer* — pick or create the customer (contact, email, job address).
2. *Capture the enquiry* — paste the customer's message, add job notes, record a voice note in the browser or upload audio (transcribed; free), and upload two or three job photographs (direct-to-bucket upload with re-encoding; previews appear).
3. *AI analysis* — run it. With the mock provider the timeline says "AI analysis completed (mock provider)". Show suggested work with catalogue matches, quantities with their source, uncertainties, missing information, customer questions, photo observations with caveats and the readiness verdict. Tick the suggestions to apply as line items. This used one generation (2 remaining).
4. *Price the work* — line items with quantity, unit, unit price, discounts, optional items and tax treatment; call-out fee, quote-level discount and the totals panel (subtotal, discount, tax, total; internal cost and margin shown only to the business).
5. *Generate wording* — one click writes title, summary, scope, inclusions, assumptions, exclusions, customer responsibilities, payment terms, schedule, warranty, validity and a follow-up email (one generation, 1 remaining). Edit a section by hand, then use **Regenerate** on a single section with an instruction (free).
6. *Review* — the customer-facing preview and PDF download.
7. *Send* — enter the customer's email, edit the message, choose the follow-up reminder days, send. In preview mode the timeline notes "not delivered"; the quote moves to **Sent** and a secure link is created.

**11. Customer experience (60 s).** Copy the customer link from the quote page's actions (next to **Rotate customer link**) or open the QUOTE_SENT email in `/app/dev/emails`, and open it in another private window: `/q/<token>` shows the branded quote, the PDF download and the accept/decline form. Accept with a typed name and the terms box. Back in the app: status **Accepted**, the acceptance record with signature and total, the timeline (sent → viewed → accepted), and the owner notification emails in `/app/dev/emails`. Mention link rotation and expiry from the quote page.

**12. Analytics (30 s).** Open `/app/analytics`: created/sent/viewed/accepted, values, acceptance rate, create-to-send time and AI usage with date ranges; explain that advanced analytics and CSV export are Pro/Starter entitlements.

**13. Billing (45 s).** Open `/app/billing`: current plan (Free trial, 1 generation left), usage, the plan cards (Starter $19/month or $190/year, Pro $39/month or $390/year, credit pack $9) and the invoices table. Click **Upgrade to Pro**: in development this opens the clearly labelled **mock checkout**; complete it and return to billing showing Pro active with 100 generations, a mock invoice, the "manage billing" and "cancel at period end" controls. Explain that production uses Stripe Checkout, the Billing Portal and signed webhooks. If time allows, open **Team** to invite a member (Pro allows five).

**14. Super admin (60 s).** Sign in as the promoted account and open `/super-admin`: the platform overview (users, workspaces, subscriptions, quotes, AI runs and estimated cost, email counts, storage, cron heartbeat) with the date range and the "exclude demo" toggle. Open **Users**, search for the account created in step 6, open it: memberships, audit history, and the admin actions (suspend with reason, revoke sessions, change role, grant credits, complimentary plan). Grant two credits with a reason and show the entry in the audit log on the same page. Then open one or two of the other sections (for example Workspaces, where a support session is started with a reason, and Site settings or Feature flags, where every change is validated and audited); all nineteen sections are implemented (see `docs/SUPER_ADMIN.md`).

**15. Close (20 s).** Recap: one codebase covering marketing site, product, customer pages, billing, AI, email, background jobs and administration; deployable on Railway from one Dockerfile; documented in `docs/`. Offer the [FLIPPA_LISTING_NOTES.md](../FLIPPA_LISTING_NOTES.md) summary and the technical docs for due diligence.

## Talking points if asked

- *Does the AI set prices?* Never. It proposes work items and quantities with sources; prices come from the tradesperson's catalogue and a deterministic calculator.
- *What if the AI fails?* The request is retried once, the output is validated and repaired once, and a credit is only consumed after success.
- *Is customer data safe?* Private bucket, signed short-lived URLs, EXIF stripping, hashed IPs, tenant-scoped queries, audited admin access; see [SECURITY.md](SECURITY.md).
- *What does it cost to run?* Railway (web, database, bucket, cron), OpenAI per generation, Resend per email, Stripe fees and a domain; see [HANDOVER.md](HANDOVER.md).
- *Operating history?* None. The product is newly built; all figures shown in the demo are sample data.
