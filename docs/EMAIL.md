# Email

Transactional email is sent through **Resend** in production and through a database-backed **preview mode** in development. The code lives in `src/lib/email/*`; every send, whether delivered or not, creates an `EmailEvent` row.

## Providers

`getEmailProvider()` (`providers.ts`) picks `ResendEmailProvider` when `RESEND_API_KEY` is set and `PreviewEmailProvider` otherwise. Production refuses to start in preview mode (`src/lib/env.ts`).

| Provider | Behaviour |
| --- | --- |
| `ResendEmailProvider` | `resend.emails.send({ from, to, replyTo, subject, html, text })`; returns `SENT` with the provider message id, or `FAILED` with the error message. `healthCheck` lists domains |
| `PreviewEmailProvider` | Delivers nothing; returns `PREVIEW`. The rendered HTML and text are stored on the `EmailEvent` so they can be read at `/app/dev/emails` or from the database |

```dotenv
RESEND_API_KEY=re_...
EMAIL_FROM=QuoteCue AI <noreply@yourdomain.com>   # must be on a domain verified in Resend
SUPPORT_EMAIL=support@yourdomain.com
```

If `EMAIL_FROM` is a bare address, the sender name is taken from the `email.fromName` site setting (default "QuoteCue AI"). `email.replyTo` (site setting) adds a Reply-To header when set.

### Resend setup

1. Add and verify your sending domain in Resend (SPF and DKIM records; a DMARC record is recommended).
2. Create an API key with sending permission and set `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on the verified domain. Resend rejects unverified senders; the failure appears as `FAILED` in `EmailEvent` and, for quote emails, as an `EMAIL_FAILED` timeline event with the message shown to the user.
4. Check `/api/health/system` (as a super admin): `email.ok` should be true with "Resend API reachable".

## Sending

`sendEmail({ kind, to, variables, workspaceId, userId, quoteId, metadata, templateOverride })` (`send.ts`):

1. Resolves the template for `kind` from `EmailTemplate` (falling back to `DEFAULT_EMAIL_TEMPLATES` when the row is missing).
2. Merges the common variables `productName` (`branding.productName`), `supportEmail` (`branding.supportEmail`) and `appUrl` (`APP_URL`) with the caller's variables.
3. Checks that the subject and body use only the template's permitted variables (`findUnsupportedVariables`). A template that references an unknown variable is **not sent**; the event is stored as `FAILED` with "Template uses unsupported variables: ...".
4. Substitutes `{{variables}}`, renders HTML and plain text, and sends through the provider unless the template is disabled (`enabled = false` → status `SKIPPED`).
5. Writes the `EmailEvent` (kind, recipient, subject, status, provider, provider message id, error, workspace/user/quote links, metadata). `htmlPreview`/`textPreview` are stored only in preview mode or under `NODE_ENV=test`.

Statuses in use: `SENT`, `PREVIEW`, `FAILED`, `SKIPPED` (`QUEUED` and `DELIVERED` exist in the enum for future webhook-based delivery tracking; nothing writes them today).

Sending never throws for provider failures; callers inspect `outcome.status`. Quote sending (`sendQuoteToCustomer`) treats `FAILED` as an error and leaves the quote unsent.

## Templates

Templates are Markdown with `{{variables}}`, seeded from `src/lib/email/templates.ts` into `EmailTemplate` (one row per `EmailKind`). Re-seeding refreshes only the `variables` list so edited subjects and bodies survive. Each template has a `name`, `subject`, `previewText` (hidden preheader), `bodyMarkdown`, `variables` and `description`.

| Kind | Name | Extra variables (all templates also get `productName`, `supportEmail`, `appUrl`) | Sent by |
| --- | --- | --- | --- |
| `WELCOME` | Welcome | `name`, `dashboardUrl` | After email verification (`auth.ts`) |
| `VERIFY_EMAIL` | Verify email | `name`, `verifyUrl` | Sign-up and "resend verification" |
| `PASSWORD_RESET` | Password reset | `name`, `resetUrl` | Forgot password; super-admin "send password reset" |
| `MAGIC_LINK` | Magic link | `magicLinkUrl` | Magic-link sign-in |
| `ACCOUNT_EXISTS` | Account already exists | `loginUrl`, `resetUrl` | Sign-up with an existing address (enumeration-safe) |
| `TEAM_INVITE` | Team invitation | `inviterName`, `workspaceName`, `inviteUrl`, `role` | `services/team.ts` |
| `QUOTE_SENT` | Quote sent to customer | `customerName`, `businessName`, `quoteNumber`, `quoteTitle`, `total`, `expiryDate`, `quoteUrl`, `message` | `sendQuoteToCustomer` |
| `QUOTE_VIEWED` | Quote viewed notification | `customerName`, `quoteNumber`, `quoteTitle`, `quoteAdminUrl` | First customer view (`recordPublicView`) |
| `QUOTE_ACCEPTED` | Quote accepted notification | `customerName`, `quoteNumber`, `quoteTitle`, `total`, `signedName`, `quoteAdminUrl` | `recordCustomerDecision` |
| `QUOTE_DECLINED` | Quote declined notification | `customerName`, `quoteNumber`, `quoteTitle`, `reason`, `quoteAdminUrl` | `recordCustomerDecision` |
| `QUOTE_EXPIRY_REMINDER` | Quote expiry reminder | `customerName`, `businessName`, `quoteNumber`, `quoteTitle`, `total`, `expiryDate`, `quoteUrl` | `send-expiry-reminders` job |
| `TRIAL_LIMIT_WARNING` | Trial limit warning | `name`, `billingUrl`, `remaining` | `quote-ai.ts` (at most once per 7 days) |
| `SUBSCRIPTION_CONFIRMED` | Subscription confirmed | `name`, `planName`, `billingUrl` | Stripe sync / mock checkout |
| `PAYMENT_FAILED` | Payment failed | `name`, `billingUrl`, `amount` | `invoice.payment_failed` webhook |
| `CONTACT_RECEIPT` | Contact form receipt | `name`, `email`, `message` | Marketing contact form, sent to `branding.supportEmail` |
| `TEST` | Test email | `name` | Defined in the enum; no code sends it. The console's **Send test** action sends the template being edited under its own kind to the admin's address (`templateOverride`) |

Owner notifications (`QUOTE_VIEWED`, `QUOTE_ACCEPTED`, `QUOTE_DECLINED`, `TRIAL_LIMIT_WARNING`, `PAYMENT_FAILED`, `SUBSCRIPTION_CONFIRMED`) go to the workspace owner's account email. Customer emails go to the address entered in the send dialog (defaulting to the customer record).

### Markdown subset and rendering

`render.ts` renders the body through the restricted parser in `src/lib/utils/safe-markdown.ts`: headings, paragraphs, ordered/unordered lists, block quotes, horizontal rules, bold, italic, inline code and links. Only `http(s)://`, `mailto:` and same-origin `/` links are allowed; anything else is rendered as plain text. Raw HTML is never interpreted, and all text is escaped. A paragraph that consists of a single link becomes a button in the brand's primary colour. The HTML wrapper is a 600 px table layout with the product name (or uploaded logo) in the header, `branding.primaryColor`/`accentColor` for headings and links, and `email.footerText` plus the app URL in the footer. A plain-text alternative is always sent.

Templates are edited on `/super-admin/emails/templates/<kind>` (validated, audited, with preview and test send; see [SUPER_ADMIN.md](SUPER_ADMIN.md)). Editing the row directly is an alternative:

```sql
UPDATE "EmailTemplate"
SET subject = 'Your quote {{quoteNumber}} from {{businessName}} is ready',
    "bodyMarkdown" = '...',
    "updatedAt" = NOW()
WHERE kind = 'QUOTE_SENT';
```

Use only the variables listed for that kind; the template will otherwise fail validation at send time and the email will not go out.

## Preview mode in development

With no `RESEND_API_KEY`:

- nothing is delivered; each email is stored as `PREVIEW` with its HTML and text;
- `/app/dev/emails` (development only, hidden in production) lists the previews addressed to the signed-in user, their workspace or their email address, and renders the selected one in a sandboxed iframe; links open in a new tab, so verification, reset, invitation and quote links can be followed;
- the quote timeline says "(email preview mode: not delivered)" and the send dialog reports preview mode;
- the `cleanup-sessions` job removes stored preview HTML older than 14 days.

The inbox needs a workspace, so the very first account's verification link must be read from the database instead (see [SETUP.md](SETUP.md)):

```sql
SELECT "toEmail", subject, "textPreview" FROM "EmailEvent" ORDER BY "createdAt" DESC LIMIT 1;
```

## Feature flags and rate limits

- `email_sending` (feature flag) blocks `sendQuoteToCustomer` when off; auth and billing emails are unaffected.
- `emailSend` rate limit: 30 quote sends per hour per workspace.
- `contactForm`: 3 submissions per 15 minutes per IP, plus a honeypot field.
- Auth emails are protected by the auth rate limits ([SECURITY.md](SECURITY.md)) and always return neutral messages so addresses cannot be enumerated.

## Monitoring

`EmailEvent` is indexed by workspace, kind and status; the super-admin overview counts sent (`SENT`/`DELIVERED`) and failed emails per period. Useful query:

```sql
SELECT kind, status, COUNT(*) FROM "EmailEvent"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY kind, status ORDER BY kind, status;
```
