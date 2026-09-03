import type { Metadata } from "next";
import Link from "next/link";
import { LayoutTemplate, Archive } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { TRADE_TEMPLATES } from "@/lib/data/trade-templates";
import { PageHeader, EmptyState, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ConfirmButton } from "@/components/app/confirm-button";
import { TemplateDialog } from "@/components/catalogue/template-dialog";
import { archiveTemplateAction, createTemplateFromTradeAction } from "./actions";
import { TradeTemplateForm } from "./trade-form";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const ctx = await requireWorkspaceForPage("/app/templates");
  const [templates, entitlements] = await Promise.all([
    prisma.quoteTemplate.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], include: { _count: { select: { quotes: true } } } }),
    getWorkspaceEntitlements(ctx.workspace.id),
  ]);
  const canAddMore = entitlements.features.CUSTOM_TEMPLATES || templates.length === 0;
  const readOnly = !!ctx.supportSession;
  return (
    <div className="space-y-6">
      <PageHeader title="Quote templates" description="Default wording applied to new quotes. One template is included on every plan; the Pro plan allows unlimited custom templates." actions={readOnly ? null : <TemplateDialog disabled={!canAddMore} />} />
      {!canAddMore ? (
        <Alert variant="info">
          Custom templates are a Pro feature.{" "}
          {ctx.isAdmin ? (
            <Link href="/app/billing" className="font-semibold underline">
              Upgrade to add more templates.
            </Link>
          ) : null}
        </Alert>
      ) : null}
      {templates.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No templates yet" description="Create a template from scratch or start from your trade's defaults." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{t.name}</CardTitle>
                    <CardDescription>{t.description ?? "No description"}</CardDescription>
                  </div>
                  {t.isDefault ? <Badge variant="accent">Default</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Used by</dt>
                    <dd className="font-semibold">{t._count.quotes} quotes</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sections filled</dt>
                    <dd className="font-semibold">{[t.scopeOfWork, t.includedWork, t.assumptions, t.exclusions, t.paymentTerms, t.warrantyWording].filter(Boolean).length} of 6</dd>
                  </div>
                </dl>
                {t.scopeOfWork ? <p className="line-clamp-3 text-sm text-muted-foreground">{t.scopeOfWork}</p> : null}
                {!readOnly ? (
                  <div className="flex gap-2">
                    <TemplateDialog
                      initial={{
                        id: t.id,
                        name: t.name,
                        description: t.description ?? "",
                        defaultTitle: t.defaultTitle ?? "",
                        scopeOfWork: t.scopeOfWork ?? "",
                        includedWork: t.includedWork ?? "",
                        assumptions: t.assumptions ?? "",
                        exclusions: t.exclusions ?? "",
                        customerResponsibilities: t.customerResponsibilities ?? "",
                        paymentTerms: t.paymentTerms ?? "",
                        warrantyWording: t.warrantyWording ?? "",
                        estimatedSchedule: t.estimatedSchedule ?? "",
                        customerQuestions: Array.isArray(t.customerQuestions) ? (t.customerQuestions as string[]).join("\n") : "",
                        isDefault: t.isDefault,
                      }}
                    />
                    {!t.isDefault ? (
                      <ConfirmButton action={archiveTemplateAction} hidden={{ id: t.id }} variant="ghost" size="sm" confirmTitle="Archive template?" confirmDescription="Existing quotes keep their wording.">
                        <Archive /> Archive
                      </ConfirmButton>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!readOnly && canAddMore ? (
        <Card>
          <CardHeader>
            <CardTitle>Start from a trade template</CardTitle>
            <CardDescription>Pre-written scope, exclusions, questions and terms for your trade.</CardDescription>
          </CardHeader>
          <CardContent>
            <TradeTemplateForm action={createTemplateFromTradeAction} trades={TRADE_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name }))} SelectComponent={Select} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
