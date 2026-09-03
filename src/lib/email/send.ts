import type { EmailKind, EmailStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEmailProvider } from "./providers";
import { renderEmailHtml, renderEmailText, substituteVariables, findUnsupportedVariables } from "./render";
import { DEFAULT_EMAIL_TEMPLATES } from "./templates";

export interface SendEmailOptions {
  kind: EmailKind;
  to: string;
  variables?: Record<string, string | number | null | undefined>;
  workspaceId?: string | null;
  userId?: string | null;
  quoteId?: string | null;
  metadata?: Record<string, unknown>;
  /** Overrides for tests or previews. */
  templateOverride?: { subject: string; bodyMarkdown: string; previewText?: string | null };
}

export interface SendEmailOutcome {
  status: EmailStatus;
  emailEventId: string;
  error?: string;
  previewMode: boolean;
}

export async function resolveEmailTemplate(kind: EmailKind) {
  const row = await prisma.emailTemplate.findUnique({ where: { kind } });
  const fallback = DEFAULT_EMAIL_TEMPLATES[kind];
  if (!row) {
    return { subject: fallback.subject, previewText: fallback.previewText, bodyMarkdown: fallback.bodyMarkdown, enabled: true, variables: fallback.variables };
  }
  return {
    subject: row.subject,
    previewText: row.previewText ?? fallback.previewText,
    bodyMarkdown: row.bodyMarkdown,
    enabled: row.enabled,
    variables: Array.isArray(row.variables) ? (row.variables as string[]) : fallback.variables,
  };
}

/**
 * Renders and sends an email through the configured provider and records an
 * EmailEvent. In preview mode nothing is delivered: the event is stored with
 * status PREVIEW and the rendered HTML so it can be inspected in development.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailOutcome> {
  const env = getEnv();
  const settings = await getSiteSettings();
  const provider = getEmailProvider();
  const template = options.templateOverride
    ? { ...options.templateOverride, previewText: options.templateOverride.previewText ?? null, enabled: true, variables: DEFAULT_EMAIL_TEMPLATES[options.kind].variables }
    : await resolveEmailTemplate(options.kind);

  const variables: Record<string, string | number | null | undefined> = {
    productName: settings["branding.productName"],
    supportEmail: settings["branding.supportEmail"],
    appUrl: env.APP_URL,
    ...options.variables,
  };

  const unsupported = findUnsupportedVariables(`${template.subject}\n${template.bodyMarkdown}`, [...template.variables, "productName", "supportEmail", "appUrl"]);
  const subject = substituteVariables(template.subject, variables);
  const bodyMarkdown = substituteVariables(template.bodyMarkdown, variables);
  const previewText = template.previewText ? substituteVariables(template.previewText, variables) : undefined;
  const branding = {
    productName: settings["branding.productName"],
    primaryColor: settings["branding.primaryColor"],
    accentColor: settings["branding.accentColor"],
    footerText: settings["email.footerText"],
    appUrl: env.APP_URL,
  };
  const html = renderEmailHtml(bodyMarkdown, branding, previewText);
  const text = renderEmailText(bodyMarkdown, branding);
  const from = env.EMAIL_FROM.includes("<") ? env.EMAIL_FROM : `${settings["email.fromName"]} <${env.EMAIL_FROM}>`;

  let status: EmailStatus;
  let providerMessageId: string | undefined;
  let error: string | undefined;

  if (!template.enabled) {
    status = "SKIPPED";
    error = "Template disabled by administrator";
  } else if (unsupported.length > 0) {
    status = "FAILED";
    error = `Template uses unsupported variables: ${unsupported.join(", ")}`;
  } else {
    const result = await provider.send({ to: options.to, from, replyTo: settings["email.replyTo"] || undefined, subject, html, text });
    status = result.status;
    providerMessageId = result.providerMessageId;
    error = result.error;
  }

  const event = await prisma.emailEvent.create({
    data: {
      kind: options.kind,
      toEmail: options.to,
      subject,
      status,
      provider: provider.name,
      providerMessageId,
      error,
      htmlPreview: provider.name === "preview" || env.isTest ? html : null,
      textPreview: provider.name === "preview" || env.isTest ? text : null,
      workspaceId: options.workspaceId ?? null,
      userId: options.userId ?? null,
      quoteId: options.quoteId ?? null,
      metadata: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : undefined,
    },
    select: { id: true },
  });

  return { status, emailEventId: event.id, error, previewMode: provider.name === "preview" };
}
