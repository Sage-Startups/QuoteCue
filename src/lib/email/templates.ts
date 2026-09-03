import type { EmailKind } from "@/generated/prisma/enums";

export interface EmailTemplateDefinition {
  name: string;
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  variables: string[];
  description: string;
}

const COMMON = ["productName", "supportEmail", "appUrl"];

/**
 * Default email templates. Super admins can edit these in the database; the
 * defaults are seeded and used as a fallback when a template row is missing.
 * Templates use {{variable}} placeholders and restricted Markdown.
 */
export const DEFAULT_EMAIL_TEMPLATES: Record<EmailKind, EmailTemplateDefinition> = {
  WELCOME: {
    name: "Welcome",
    description: "Sent after a user verifies their email address.",
    subject: "Welcome to {{productName}}",
    previewText: "Your account is ready. Create your first quote in minutes.",
    variables: [...COMMON, "name", "dashboardUrl"],
    bodyMarkdown: `# Welcome, {{name}}

Your {{productName}} account is verified and ready to go.

You can now turn customer messages, voice notes and job photographs into professional quotes in minutes.

[Open your dashboard]({{dashboardUrl}})

If you have any questions, reply to this email or contact {{supportEmail}}.`,
  },
  VERIFY_EMAIL: {
    name: "Verify email",
    description: "Sent on registration to confirm the address.",
    subject: "Verify your email for {{productName}}",
    previewText: "Confirm your email address to finish setting up your account.",
    variables: [...COMMON, "name", "verifyUrl"],
    bodyMarkdown: `# Confirm your email address

Hi {{name}}, thanks for signing up to {{productName}}.

Please confirm your email address to activate your account:

[Verify my email]({{verifyUrl}})

This link expires in one hour. If you did not create an account, you can ignore this email.`,
  },
  PASSWORD_RESET: {
    name: "Password reset",
    description: "Sent when a user requests a password reset.",
    subject: "Reset your {{productName}} password",
    previewText: "Use the link inside to choose a new password.",
    variables: [...COMMON, "name", "resetUrl"],
    bodyMarkdown: `# Reset your password

Hi {{name}}, we received a request to reset the password for your {{productName}} account.

[Choose a new password]({{resetUrl}})

This link expires in one hour. If you did not request a reset, no action is needed. For your security, all other sessions will be signed out once the password is changed.`,
  },
  MAGIC_LINK: {
    name: "Magic link",
    description: "Passwordless sign-in link.",
    subject: "Your {{productName}} sign-in link",
    previewText: "Click to sign in. The link expires shortly.",
    variables: [...COMMON, "magicLinkUrl"],
    bodyMarkdown: `# Sign in to {{productName}}

Use the button below to sign in. This link can only be used once and expires in 10 minutes.

[Sign in now]({{magicLinkUrl}})

If you did not request this link, you can safely ignore this email.`,
  },
  ACCOUNT_EXISTS: {
    name: "Account already exists",
    description: "Sent when somebody tries to register with an email that already has an account (prevents enumeration).",
    subject: "Your {{productName}} account",
    previewText: "Somebody tried to create an account with this email.",
    variables: [...COMMON, "loginUrl", "resetUrl"],
    bodyMarkdown: `# You already have an account

Somebody (probably you) tried to create a {{productName}} account with this email address, but an account already exists.

[Sign in]({{loginUrl}}) or [reset your password]({{resetUrl}}) if you have forgotten it.

If this was not you, no action is required.`,
  },
  TEAM_INVITE: {
    name: "Team invitation",
    description: "Sent when a workspace admin invites a team member.",
    subject: "{{inviterName}} invited you to {{workspaceName}} on {{productName}}",
    previewText: "Join your team's workspace.",
    variables: [...COMMON, "inviterName", "workspaceName", "inviteUrl", "role"],
    bodyMarkdown: `# You have been invited

{{inviterName}} has invited you to join **{{workspaceName}}** on {{productName}} as a {{role}}.

[Accept the invitation]({{inviteUrl}})

This invitation expires in 7 days.`,
  },
  QUOTE_SENT: {
    name: "Quote sent to customer",
    description: "The email a customer receives with their quote link.",
    subject: "Your quote {{quoteNumber}} from {{businessName}}",
    previewText: "View, download and accept your quote online.",
    variables: [...COMMON, "customerName", "businessName", "quoteNumber", "quoteTitle", "total", "expiryDate", "quoteUrl", "message"],
    bodyMarkdown: `# Your quote from {{businessName}}

Hi {{customerName}},

{{message}}

**Quote {{quoteNumber}} — {{quoteTitle}}**
Total: **{{total}}**
Valid until: {{expiryDate}}

[View and accept your quote]({{quoteUrl}})

You can download a PDF copy, accept, or decline from the link above.`,
  },
  QUOTE_VIEWED: {
    name: "Quote viewed notification",
    description: "Notifies the quote owner the first time a customer opens the quote.",
    subject: "{{customerName}} viewed quote {{quoteNumber}}",
    previewText: "Your customer has opened the quote.",
    variables: [...COMMON, "customerName", "quoteNumber", "quoteTitle", "quoteAdminUrl"],
    bodyMarkdown: `# Your quote was viewed

{{customerName}} has just opened quote **{{quoteNumber}}** ({{quoteTitle}}).

[Open the quote]({{quoteAdminUrl}})`,
  },
  QUOTE_ACCEPTED: {
    name: "Quote accepted notification",
    description: "Notifies the quote owner that the customer accepted.",
    subject: "Quote {{quoteNumber}} accepted by {{customerName}}",
    previewText: "Great news — the customer accepted your quote.",
    variables: [...COMMON, "customerName", "quoteNumber", "quoteTitle", "total", "signedName", "quoteAdminUrl"],
    bodyMarkdown: `# Quote accepted

{{customerName}} accepted quote **{{quoteNumber}}** ({{quoteTitle}}) for **{{total}}**.

Signed as: {{signedName}}

[Open the quote]({{quoteAdminUrl}})`,
  },
  QUOTE_DECLINED: {
    name: "Quote declined notification",
    description: "Notifies the quote owner that the customer declined.",
    subject: "Quote {{quoteNumber}} declined by {{customerName}}",
    previewText: "The customer declined your quote.",
    variables: [...COMMON, "customerName", "quoteNumber", "quoteTitle", "reason", "quoteAdminUrl"],
    bodyMarkdown: `# Quote declined

{{customerName}} declined quote **{{quoteNumber}}** ({{quoteTitle}}).

Reason given: {{reason}}

[Open the quote]({{quoteAdminUrl}})`,
  },
  QUOTE_EXPIRY_REMINDER: {
    name: "Quote expiry reminder",
    description: "Reminds the customer that a quote is about to expire.",
    subject: "Your quote {{quoteNumber}} expires on {{expiryDate}}",
    previewText: "Your quote is about to expire.",
    variables: [...COMMON, "customerName", "businessName", "quoteNumber", "quoteTitle", "total", "expiryDate", "quoteUrl"],
    bodyMarkdown: `# Your quote expires soon

Hi {{customerName}}, a reminder that quote **{{quoteNumber}}** from {{businessName}} ({{quoteTitle}}, {{total}}) is valid until **{{expiryDate}}**.

[View your quote]({{quoteUrl}})`,
  },
  TRIAL_LIMIT_WARNING: {
    name: "Trial limit warning",
    description: "Sent when a trial workspace uses its last free AI generation.",
    subject: "You have used your free AI generations",
    previewText: "Upgrade to keep creating quotes with AI.",
    variables: [...COMMON, "name", "billingUrl", "remaining"],
    bodyMarkdown: `# Your free AI generations are almost gone

Hi {{name}}, you have {{remaining}} free AI generations left on your trial.

Upgrade to Starter or Pro to keep turning enquiries into quotes.

[See plans]({{billingUrl}})`,
  },
  SUBSCRIPTION_CONFIRMED: {
    name: "Subscription confirmed",
    description: "Sent after a successful subscription checkout.",
    subject: "Your {{planName}} subscription is active",
    previewText: "Thanks for subscribing.",
    variables: [...COMMON, "name", "planName", "billingUrl"],
    bodyMarkdown: `# Subscription confirmed

Hi {{name}}, your **{{planName}}** subscription is now active.

You can manage your plan, invoices and payment method at any time.

[Manage billing]({{billingUrl}})`,
  },
  PAYMENT_FAILED: {
    name: "Payment failed",
    description: "Sent when a subscription payment fails.",
    subject: "Action needed: payment failed for {{productName}}",
    previewText: "Update your payment method to keep your subscription active.",
    variables: [...COMMON, "name", "billingUrl", "amount"],
    bodyMarkdown: `# We could not take your payment

Hi {{name}}, your latest payment of {{amount}} for {{productName}} was unsuccessful.

Please update your payment method to keep your subscription active.

[Update payment method]({{billingUrl}})`,
  },
  CONTACT_RECEIPT: {
    name: "Contact form receipt",
    description: "Sent to the support inbox when a contact form is submitted.",
    subject: "New contact form message from {{name}}",
    previewText: "Somebody contacted you through the website.",
    variables: [...COMMON, "name", "email", "message"],
    bodyMarkdown: `# New contact form message

**From:** {{name}} ({{email}})

{{message}}`,
  },
  TEST: {
    name: "Test email",
    description: "Used by super admins to test email delivery.",
    subject: "{{productName}} test email",
    previewText: "This is a test email.",
    variables: [...COMMON, "name"],
    bodyMarkdown: `# Test email

Hi {{name}}, this is a test email from {{productName}}. If you are reading this, email delivery is working.`,
  },
};

export const EMAIL_KINDS = Object.keys(DEFAULT_EMAIL_TEMPLATES) as EmailKind[];
