import type { SiteSettings } from "@/lib/config/site-settings";

/**
 * Legal page copy for a UK-based SaaS. Written in the restricted Markdown
 * subset supported by `safe-markdown`. Company details come from site
 * settings; anything we cannot know is left as a clearly marked placeholder.
 */

export const LEGAL_LAST_UPDATED = "2 September 2026";

export interface LegalContext {
  settings: SiteSettings;
  appUrl: string;
  analyticsConfigured: boolean;
}

function companyLine(settings: SiteSettings): string {
  const name = settings["branding.companyName"];
  const address = settings["branding.companyAddress"].trim().replace(/\s*\n\s*/g, ", ");
  return address ? `${name}, ${address}` : `${name}, [Registered office address]`;
}

export function privacyPolicy({ settings, appUrl }: LegalContext): string {
  const product = settings["branding.productName"];
  const company = settings["branding.companyName"];
  const support = settings["branding.supportEmail"];
  return `
## 1. Who we are

${product} ("the Service") is operated by ${company} ("we", "us", "our"), a company registered in England and Wales under company number [Company registration number]. Our registered office is ${companyLine(settings)}. We are the data controller for personal data collected through ${appUrl} and the Service.

You can contact us about privacy at [${support}](mailto:${support}).

## 2. The data we collect

We collect the following categories of personal data:

- **Account data** — your name, email address, password (stored only as a salted hash), locale and the workspace you belong to.
- **Business data you enter** — your business name, address, logo, service catalogue, pricing, quote templates and terms.
- **Customer data you enter** — names, email addresses, phone numbers, addresses and messages of the customers you quote for. For this data you are the controller and we act as your processor (see section 8).
- **Job content** — enquiry text, voice notes, photographs and documents that you upload so the Service can help draft a quote.
- **Quote activity** — when a customer opens, downloads, accepts or declines a quote, we record the event, the time and a hashed (irreversible) form of the IP address.
- **Billing data** — your plan, invoices and payment status. Card details are collected and stored by our payment provider, Stripe; we never see your full card number.
- **Support and contact data** — messages you send through the contact form or to our support inbox.
- **Technical data** — server logs, error reports and product usage events used to keep the Service reliable and secure.

## 3. How we use AI

To draft quotes, the Service sends the job content you provide (enquiry text, transcribed voice notes, photographs and documents) to a third-party AI provider. The AI proposes work items, wording and questions; it never sets prices, which are always calculated from your own catalogue on our servers.

We do not allow our AI providers to use your content to train their models. AI output is a suggestion for you to review and may be inaccurate; you remain responsible for the quotes you send.

## 4. Why we process your data and our lawful bases

- To provide the Service under our contract with you (**contract**).
- To send transactional emails such as verification, password reset, quote notifications and billing receipts (**contract**).
- To keep the Service secure, prevent abuse, apply rate limits and investigate incidents (**legitimate interests**).
- To understand how the Service is used and improve it, using aggregated analytics from our own database (**legitimate interests**).
- To comply with tax, accounting and other legal obligations (**legal obligation**).
- To send marketing emails, only where you have opted in, and you can withdraw at any time (**consent**).

## 5. Who we share data with

We share personal data only with providers we need to run the Service, each under a written contract:

- **Hosting and database** — application, PostgreSQL database and private object storage hosted with Railway.
- **AI processing** — OpenAI, for enquiry analysis, image description, transcription and wording generation.
- **Email delivery** — Resend, for transactional email.
- **Payments** — Stripe, for subscriptions, credit packs and invoices.

We do not sell personal data and we do not share it with advertisers.

## 6. International transfers

Some of our providers process data outside the United Kingdom, including in the United States. Where this happens we rely on the UK International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses, together with the provider's own safeguards, so that your data receives protection equivalent to UK law.

## 7. How long we keep data

- Account and business data are kept while your account is active and deleted within 30 days of a confirmed account deletion.
- Uploaded job media attached to archived quotes is deleted after the retention period shown in your workspace settings (${settings["app.dataRetentionDays"]} days by default).
- Incomplete uploads are removed after ${settings["app.uploadRetentionDays"]} day(s).
- Invoices and billing records are kept for six years to meet HMRC requirements.
- Server logs are kept for no more than 90 days.

## 8. When you are the controller

Your customers' details and job content belong to you. When you use the Service to process that data, we act as your processor and only process it on your documented instructions, which are set out in our [Terms of Service](/terms). You are responsible for having a lawful basis to enter your customers' data and for responding to their requests.

## 9. Your rights

Under the UK GDPR and the Data Protection Act 2018 you have the right to access, correct, delete or restrict the processing of your personal data, to object to processing based on our legitimate interests, to data portability and to withdraw consent. You can export your quotes and customers from the app, and delete your account from account settings. For anything else, email [${support}](mailto:${support}) and we will respond within one month.

You also have the right to complain to the Information Commissioner's Office (ICO) at [ico.org.uk](https://ico.org.uk/) if you are unhappy with how we handle your data.

## 10. Security

We protect data with encryption in transit (TLS), encrypted storage, hashed passwords and tokens, signed short-lived file links, role-based access control and audit logging of administrative actions. No system is perfectly secure; if we become aware of a breach affecting your data we will notify you and, where required, the ICO without undue delay.

## 11. Children

The Service is intended for businesses and is not directed at children under 16. We do not knowingly collect data from children.

## 12. Changes to this policy

We may update this policy from time to time. We will show the date of the latest version at the top of this page and, for significant changes, notify account holders by email.
`.trim();
}

export function termsOfService({ settings, appUrl }: LegalContext): string {
  const product = settings["branding.productName"];
  const company = settings["branding.companyName"];
  const support = settings["branding.supportEmail"];
  return `
## 1. These terms

These terms of service ("Terms") govern your use of ${product} ("the Service") provided by ${company} ("we", "us", "our"), a company registered in England and Wales under company number [Company registration number] with its registered office at ${companyLine(settings)}. By creating an account or using the Service at ${appUrl} you agree to these Terms and to our [Privacy Policy](/privacy).

The Service is provided to businesses and sole traders. By registering you confirm that you are acting in the course of a trade or business and that you are authorised to bind that business.

## 2. Your account

- You must provide accurate details and keep your password secure. You are responsible for all activity under your account.
- Each workspace has an owner who is responsible for the members they invite.
- You must be at least 18 years old to use the Service.
- We may suspend or close accounts that breach these Terms, are used for fraud or abuse, or remain unpaid.

## 3. Plans, credits and payment

- The free trial includes a fixed number of AI generations at no charge and requires no card.
- Paid plans are billed monthly or annually in advance through our payment provider, Stripe. Prices are shown in US dollars and exclude any applicable taxes.
- Subscriptions renew automatically until cancelled. You can cancel at any time from your billing settings; your plan stays active until the end of the paid period, and we do not offer pro-rated refunds for unused time except where required by law.
- Credit packs are one-off purchases. Credits do not expire while your account is active and are not refundable once used.
- An AI generation is one successful enquiry analysis or one successful wording generation. Failed runs are not charged.
- If a payment fails we will retry and notify you. If payment is not received we may downgrade your workspace to the free plan.
- We may change prices with at least 30 days' notice by email. Changes take effect at your next renewal.

## 4. Your content

- You own the enquiries, photographs, voice notes, catalogues, customer details and quotes you put into the Service ("Your Content").
- You grant us a limited licence to host, process, transmit and display Your Content solely to provide the Service to you, including sending it to our AI and email providers on your behalf.
- You are responsible for Your Content and for having the right to upload it, including your customers' personal data. You must not upload content that is unlawful, infringes anyone's rights, or contains malware.
- We process personal data in Your Content as your processor in accordance with our Privacy Policy. We will only process it on your instructions, keep it confidential, assist you with data-subject requests where reasonable, and delete it when you delete your account.

## 5. AI assistance and your responsibility

The Service uses artificial intelligence to suggest work items, quantities, wording and questions. **AI output is a proposal, not advice.** It may be incomplete or wrong, and it cannot verify hidden conditions, compliance, safety or measurements from a photograph or message.

You are solely responsible for reviewing, editing and approving every quote before it is sent, for the prices you charge, and for the work you agree to carry out. Prices are calculated from your own catalogue and settings; the AI never sets a price. We are not a party to any contract between you and your customers.

## 6. Acceptable use

You must not:

- use the Service to send spam or unsolicited messages;
- attempt to access other users' data, probe or disrupt the Service, or bypass rate limits or security controls;
- resell or sub-license the Service without our written agreement;
- use the Service in breach of any law, including consumer protection and data protection law;
- upload content that is abusive, discriminatory or otherwise objectionable.

## 7. Our service commitments

We will provide the Service with reasonable skill and care and aim for high availability, but we do not guarantee that it will be uninterrupted or error-free. We may modify features, and we will give reasonable notice of any change that materially reduces the Service. Scheduled maintenance will be announced where practical.

## 8. Intellectual property

The Service, including its software, design, templates and trade marks, belongs to us or our licensors. These Terms do not transfer any of that to you. Example catalogues and wording provided in the Service are templates you may adapt for your own quotes.

## 9. Third-party services

The Service relies on third parties for hosting, AI, email and payments. Their availability is outside our control. Your use of Stripe is also subject to Stripe's terms.

## 10. Liability

Nothing in these Terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law.

Subject to that, we are not liable for any loss of profit, loss of business, loss of contracts, or indirect or consequential loss arising from your use of the Service, including losses arising from quotes prepared with AI assistance. Our total liability to you in any 12-month period is limited to the amount you paid us for the Service in that period.

## 11. Termination

You may close your account at any time from account settings. We may terminate or suspend your access if you materially breach these Terms and, where the breach can be remedied, fail to do so within 14 days of notice. On termination your right to use the Service ends and we will delete Your Content in line with our Privacy Policy. You may export your data before closing your account.

## 12. Changes to these terms

We may update these Terms. We will show the date of the latest version at the top of this page and give at least 14 days' notice by email of material changes. Continuing to use the Service after that date means you accept the new Terms.

## 13. General

These Terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction over any dispute. If any part of these Terms is found to be unenforceable, the rest continues to apply. These Terms are the entire agreement between us regarding the Service.

## 14. Contact

Questions about these Terms can be sent to [${support}](mailto:${support}).
`.trim();
}

export function cookiePolicy({ settings, analyticsConfigured }: LegalContext): string {
  const product = settings["branding.productName"];
  const company = settings["branding.companyName"];
  const support = settings["branding.supportEmail"];
  const analyticsSection = analyticsConfigured
    ? `
## 4. Optional analytics cookies

This site is configured to load an external analytics service to help us understand which pages are useful. Analytics cookies are **optional**: they are only set after you accept them, and you can withdraw consent at any time by clearing cookies for this site in your browser. Analytics data is aggregated and is never used to identify you personally or for advertising.

- **Analytics cookies** (set by the analytics provider) — distinguish visitors and sessions so we can count page views in aggregate. They last up to 13 months.
`
    : `
## 4. Analytics

We do **not** use third-party analytics or advertising cookies on this site. Product analytics shown to account holders are calculated from our own database, not from tracking cookies.
`;
  return `
## 1. What cookies are

Cookies are small text files that a website stores on your device. ${product} uses a small number of cookies that are needed for the Service to work. This policy explains what they are and how long they last. It is issued by ${company} and forms part of our [Privacy Policy](/privacy).

## 2. Strictly necessary cookies

These cookies are essential for signing in and keeping the Service secure. They do not require consent under the Privacy and Electronic Communications Regulations (PECR) because the Service cannot function without them.

- **Session cookie** (\`quotecue.session_token\`, set by our authentication system, Better Auth) — keeps you signed in after you log in. It is marked HttpOnly, Secure and SameSite, expires after 7 days of inactivity and is removed when you sign out.
- **Session data cookie** (\`quotecue.session_data\`, where used) — a short-lived cache of your session used to reduce database lookups. Expires within minutes.
- **Workspace selection cookie** (\`quotecue.workspace\`) — remembers which of your workspaces you last used so the app opens in the right place. Contains only a workspace identifier and lasts up to 12 months.
- **Security cookies** — our authentication system may set short-lived cookies to protect forms and sign-in flows against cross-site request forgery.

## 3. Quote viewer cookie

When a customer opens a quote from a secure link we set a **quote viewer cookie**. It contains a random identifier and no personal data. We use it to count a repeat visit from the same browser once rather than many times, so the tradesperson who sent the quote sees accurate view activity. It does not track you across other websites and lasts up to ${settings["app.publicLinkValidityDays"]} days, matching the validity of the quote link.
${analyticsSection}
## 5. Browser storage

The app may also use your browser's local storage to remember interface preferences such as the last tab you used. This information never leaves your device.

## 6. Managing cookies

You can delete or block cookies in your browser settings. Blocking strictly necessary cookies will prevent you from signing in to ${product} or from viewing quotes sent to you.

## 7. Contact

Questions about cookies can be sent to [${support}](mailto:${support}).
`.trim();
}
