import { z } from "zod";

/**
 * Client-safe definitions of the site settings: schemas, descriptions and
 * defaults. This module must not import the database or the environment so
 * it can be bundled into the super-admin settings form.
 *
 * Site settings are stored as JSON values keyed by setting name in the
 * SiteSetting table. Each key has a schema and a default so the application
 * always has a valid configuration even before the first admin edit.
 */

export const settingSchemas = {
  "branding.productName": z.string().min(1).max(60).default("QuoteCue AI"),
  "branding.tagline": z.string().max(160).default("From enquiry to professional quote in minutes."),
  "branding.logoObjectId": z.string().uuid().nullable().default(null),
  "branding.faviconObjectId": z.string().uuid().nullable().default(null),
  "branding.socialImageObjectId": z.string().uuid().nullable().default(null),
  "branding.primaryColor": z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f1f3d"),
  "branding.accentColor": z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#d97706"),
  "branding.supportEmail": z.string().email().default("support@example.com"),
  "branding.companyName": z.string().max(120).default("QuoteCue AI"),
  "branding.companyAddress": z.string().max(400).default(""),
  "branding.socialLinks": z
    .object({
      x: z.string().url().or(z.literal("")).default(""),
      linkedin: z.string().url().or(z.literal("")).default(""),
      facebook: z.string().url().or(z.literal("")).default(""),
      instagram: z.string().url().or(z.literal("")).default(""),
      youtube: z.string().url().or(z.literal("")).default(""),
    })
    .default({ x: "", linkedin: "", facebook: "", instagram: "", youtube: "" }),
  "seo.defaultTitle": z.string().max(80).default("QuoteCue AI — Turn job enquiries into professional quotes in minutes"),
  "seo.defaultDescription": z
    .string()
    .max(200)
    .default(
      "QuoteCue AI helps electricians, plumbers, builders and other trades turn customer messages, voice notes and job photos into clear, professional quotes.",
    ),
  "app.registrationEnabled": z.boolean().default(true),
  "app.maintenanceMode": z.boolean().default(false),
  "app.maintenanceMessage": z.string().max(400).default("QuoteCue AI is undergoing scheduled maintenance. Please check back shortly."),
  "app.trialCredits": z.number().int().min(0).max(100).default(3),
  "app.defaultQuoteExpiryDays": z.number().int().min(1).max(365).default(30),
  "app.maxImageMb": z.number().int().min(1).max(50).default(15),
  "app.maxAudioMb": z.number().int().min(1).max(100).default(25),
  "app.maxDocumentMb": z.number().int().min(1).max(50).default(10),
  "app.maxLogoMb": z.number().int().min(1).max(10).default(2),
  "app.maxImagesPerQuote": z.number().int().min(1).max(30).default(10),
  "app.allowedImageTypes": z.array(z.string()).default(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  "app.allowedAudioTypes": z
    .array(z.string())
    .default(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a", "audio/mp4", "audio/webm", "audio/ogg"]),
  "app.allowedDocumentTypes": z.array(z.string()).default(["application/pdf", "text/plain"]),
  "app.supportedCurrencies": z.array(z.enum(["USD", "GBP", "EUR", "CAD", "AUD", "NZD"])).default(["USD", "GBP", "EUR", "CAD", "AUD", "NZD"]),
  "app.taxLabels": z
    .object({ VAT: z.string().default("VAT"), GST: z.string().default("GST"), SALES_TAX: z.string().default("Sales tax"), CUSTOM: z.string().default("Tax") })
    .default({ VAT: "VAT", GST: "GST", SALES_TAX: "Sales tax", CUSTOM: "Tax" }),
  "app.dataRetentionDays": z.number().int().min(30).max(3650).default(730),
  "app.uploadRetentionDays": z.number().int().min(1).max(365).default(1),
  "app.publicLinkValidityDays": z.number().int().min(7).max(730).default(180),
  "app.demoResetHours": z.number().int().min(1).max(720).default(24),
  "email.fromName": z.string().max(80).default("QuoteCue AI"),
  "email.replyTo": z.string().email().or(z.literal("")).default(""),
  "email.footerText": z.string().max(400).default("You are receiving this email because you have an account with QuoteCue AI."),
  "email.quoteReminderDaysBefore": z.number().int().min(1).max(30).default(3),
  "analytics.externalId": z.string().max(120).default(""),
  "ai.enabled": z.boolean().default(true),
  "ai.textModel": z.string().max(80).default(""),
  "ai.visionModel": z.string().max(80).default(""),
  "ai.transcribeModel": z.string().max(80).default(""),
  "ai.inputCostCentsPerMillionTokens": z.number().min(0).max(100000).default(25),
  "ai.outputCostCentsPerMillionTokens": z.number().min(0).max(100000).default(200),
  "ai.transcriptionCostCentsPerMinute": z.number().min(0).max(1000).default(0.3),
  "announcement.enabled": z.boolean().default(false),
  "announcement.message": z.string().max(240).default(""),
  "announcement.linkLabel": z.string().max(60).default(""),
  "announcement.linkHref": z.string().max(300).default(""),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;
export type SiteSettings = { [K in SettingKey]: SettingValue<K> };

export const SETTING_DESCRIPTIONS: Record<SettingKey, string> = {
  "branding.productName": "Product name shown across the site, app and emails.",
  "branding.tagline": "Short tagline used in metadata and the footer.",
  "branding.logoObjectId": "Uploaded logo object (leave empty to use the built-in logo).",
  "branding.faviconObjectId": "Uploaded favicon object (leave empty to use the built-in favicon).",
  "branding.socialImageObjectId": "Uploaded social sharing image (leave empty to use the built-in image).",
  "branding.primaryColor": "Primary brand colour (hex).",
  "branding.accentColor": "Accent brand colour (hex).",
  "branding.supportEmail": "Support email address shown to users.",
  "branding.companyName": "Legal company name for the footer and legal pages.",
  "branding.companyAddress": "Company address for the footer and legal pages.",
  "branding.socialLinks": "Social profile links for the footer.",
  "seo.defaultTitle": "Default page title.",
  "seo.defaultDescription": "Default meta description.",
  "app.registrationEnabled": "Allow new registrations.",
  "app.maintenanceMode": "Show a maintenance page to non-admin visitors.",
  "app.maintenanceMessage": "Message shown while maintenance mode is enabled.",
  "app.trialCredits": "AI generations granted to a new workspace.",
  "app.defaultQuoteExpiryDays": "Default quote validity period for new workspaces.",
  "app.maxImageMb": "Maximum photograph size (MB).",
  "app.maxAudioMb": "Maximum audio upload size (MB).",
  "app.maxDocumentMb": "Maximum document size (MB).",
  "app.maxLogoMb": "Maximum logo size (MB).",
  "app.maxImagesPerQuote": "Maximum photographs per quote.",
  "app.allowedImageTypes": "Accepted image MIME types.",
  "app.allowedAudioTypes": "Accepted audio MIME types.",
  "app.allowedDocumentTypes": "Accepted document MIME types.",
  "app.supportedCurrencies": "Currencies offered during onboarding.",
  "app.taxLabels": "Display labels for tax modes.",
  "app.dataRetentionDays": "Days to keep archived quote media before deletion.",
  "app.uploadRetentionDays": "Days to keep incomplete uploads before cleanup.",
  "app.publicLinkValidityDays": "How long customer quote links remain valid.",
  "app.demoResetHours": "Automatically reset the demo workspace after this many hours.",
  "email.fromName": "Sender name for outgoing email.",
  "email.replyTo": "Reply-to address (optional).",
  "email.footerText": "Footer text added to every email.",
  "email.quoteReminderDaysBefore": "Days before expiry to send the reminder email.",
  "analytics.externalId": "Optional external analytics ID (never required for dashboards).",
  "ai.enabled": "Master switch for AI features.",
  "ai.textModel": "Text model override (blank uses OPENAI_TEXT_MODEL).",
  "ai.visionModel": "Vision model override (blank uses OPENAI_VISION_MODEL).",
  "ai.transcribeModel": "Transcription model override (blank uses OPENAI_TRANSCRIBE_MODEL).",
  "ai.inputCostCentsPerMillionTokens": "Cost assumption: US cents per million input tokens.",
  "ai.outputCostCentsPerMillionTokens": "Cost assumption: US cents per million output tokens.",
  "ai.transcriptionCostCentsPerMinute": "Cost assumption: US cents per minute of audio.",
  "announcement.enabled": "Show the announcement banner on the marketing site.",
  "announcement.message": "Announcement banner text.",
  "announcement.linkLabel": "Announcement link label.",
  "announcement.linkHref": "Announcement link destination.",
};

export function settingDefault<K extends SettingKey>(key: K): SettingValue<K> {
  return settingSchemas[key].parse(undefined) as SettingValue<K>;
}

export function defaultSiteSettings(): SiteSettings {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(settingSchemas) as SettingKey[]) {
    out[key] = settingDefault(key);
  }
  return out as SiteSettings;
}
