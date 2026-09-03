import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSiteSettings } from "@/lib/config/site-settings";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_KINDS } from "@/lib/email/templates";
import { renderEmailHtml, substituteVariables } from "@/lib/email/render";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { enumParam } from "../../../_lib/admin";
import { sampleVariables } from "../samples";
import { EmailTemplateEditor } from "./editor";

export const metadata: Metadata = { title: "Email template" };

export default async function EmailTemplateEditPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: raw } = await params;
  const admin = await requireSuperAdminForPage(`/super-admin/emails/templates/${raw}`);
  const kind = enumParam(raw, EMAIL_KINDS);
  if (!kind) notFound();
  const def = DEFAULT_EMAIL_TEMPLATES[kind];
  const [row, settings] = await Promise.all([prisma.emailTemplate.findUnique({ where: { kind } }), getSiteSettings()]);
  const env = getEnv();
  const stored = row && Array.isArray(row.variables) ? (row.variables as string[]) : def.variables;
  const variables = [...new Set([...stored, "productName", "supportEmail", "appUrl"])];
  const initial = { name: row?.name ?? def.name, subject: row?.subject ?? def.subject, previewText: row?.previewText ?? def.previewText, bodyMarkdown: row?.bodyMarkdown ?? def.bodyMarkdown, enabled: row?.enabled ?? true };
  const vars = sampleVariables(variables, { productName: settings["branding.productName"], supportEmail: settings["branding.supportEmail"], appUrl: env.APP_URL });
  const branding = { productName: settings["branding.productName"], primaryColor: settings["branding.primaryColor"], accentColor: settings["branding.accentColor"], footerText: settings["email.footerText"], appUrl: env.APP_URL };
  const initialPreview = { subject: substituteVariables(initial.subject, vars), html: renderEmailHtml(substituteVariables(initial.bodyMarkdown, vars), branding, initial.previewText ? substituteVariables(initial.previewText, vars) : undefined) };
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/emails/templates" className="hover:underline">
            Email templates
          </Link>
        }
        title={initial.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{def.description}</span>
            <Badge variant={row ? "info" : "muted"}>{row ? `Customised ${formatDateTime(row.updatedAt)}` : "Built-in default"}</Badge>
            <Badge variant="outline">{kind}</Badge>
          </span>
        }
      />
      <EmailTemplateEditor kind={kind} initial={initial} variables={variables} customised={!!row} initialPreview={initialPreview} adminEmail={admin.user.email} />
    </div>
  );
}
