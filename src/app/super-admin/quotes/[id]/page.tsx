import { timeAgo } from "@/components/admin/format";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildQuoteDocument } from "@/lib/services/quote-document";
import { customerDisplayName } from "@/lib/services/customers";
import { formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { STATUS_LABELS } from "@/lib/quotes/status";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DescriptionList, InlineLink, JsonBlock } from "@/components/admin/misc";
import { DemoBadge } from "@/components/admin/badges";
import { QuotePreview } from "@/components/quotes/quote-preview";
import { isUuid } from "../../_lib/admin";
import { SUPPORT_VIEW_WINDOW_MS } from "../query";
import { RevealPrivateContentForm } from "./reveal-form";

export const metadata: Metadata = { title: "Quote" };

function PrivateText({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {value?.trim() ? <p className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm">{value}</p> : <p className="mt-1 text-sm text-muted-foreground">Empty</p>}
    </div>
  );
}

export default async function QuoteAdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireSuperAdminForPage(`/super-admin/quotes/${id}`);
  if (!isUuid(id)) notFound();
  const quote = await prisma.quote.findFirst({
    where: { id, deletedAt: null },
    include: { workspace: { select: { id: true, name: true, isDemo: true } }, customer: { select: { contactName: true, companyName: true } }, createdBy: { select: { id: true, name: true } }, currentVersion: { select: { versionNumber: true, subtotalMinor: true, discountMinor: true, taxMinor: true, totalMinor: true } }, _count: { select: { versions: true, media: true, events: true } } },
  });
  if (!quote) notFound();
  const [grant, recentAccess] = await Promise.all([
    prisma.adminAuditLog.findFirst({ where: { action: "quote.support_view", actorUserId: admin.user.id, targetId: quote.id, createdAt: { gte: timeAgo(SUPPORT_VIEW_WINDOW_MS) } }, orderBy: { createdAt: "desc" } }),
    prisma.adminAuditLog.findMany({ where: { action: "quote.support_view", targetId: quote.id }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true, email: true } } } }),
  ]);
  const unlocked = !!grant;
  const document = unlocked ? await buildQuoteDocument(quote.workspaceId, quote.id, { includeLogo: false }).catch(() => null) : null;
  const expiresAt = grant ? new Date(grant.createdAt.getTime() + SUPPORT_VIEW_WINDOW_MS) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/quotes" className="hover:underline">
            Quotes
          </Link>
        }
        title={quote.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{quote.number}</span>
            <Badge variant="outline">{STATUS_LABELS[quote.status]}</Badge>
            {quote.workspace.isDemo ? <DemoBadge /> : null}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Always visible. Does not include enquiry text, notes or wording.</CardDescription>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Workspace", value: <InlineLink href={`/super-admin/workspaces/${quote.workspace.id}`}>{quote.workspace.name}</InlineLink> },
                { label: "Customer", value: quote.customer ? customerDisplayName(quote.customer) : "—" },
                { label: "Created by", value: quote.createdBy ? <InlineLink href={`/super-admin/users/${quote.createdBy.id}`}>{quote.createdBy.name}</InlineLink> : "—" },
                { label: "Status", value: STATUS_LABELS[quote.status] },
                { label: "Total", value: formatMoney(quote.totalMinor, quote.currency) },
                { label: "Version", value: quote.currentVersion ? `v${quote.currentVersion.versionNumber} of ${quote._count.versions}` : "—" },
                { label: "Totals", value: quote.currentVersion ? `Subtotal ${formatMoney(quote.currentVersion.subtotalMinor, quote.currency)} · discount ${formatMoney(quote.currentVersion.discountMinor, quote.currency)} · tax ${formatMoney(quote.currentVersion.taxMinor, quote.currency)}` : "—" },
                { label: "Attachments", value: `${quote._count.media} media · ${quote._count.events} events` },
                { label: "Wizard step", value: quote.wizardStep },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Created", value: formatDateTime(quote.createdAt) },
                { label: "Updated", value: formatDateTime(quote.updatedAt) },
                { label: "Ready", value: formatDateTime(quote.readyAt) },
                { label: "Sent", value: formatDateTime(quote.sentAt) },
                { label: "First viewed", value: `${formatDateTime(quote.firstViewedAt)} (${quote.viewCount} view${quote.viewCount === 1 ? "" : "s"})` },
                { label: "Accepted", value: formatDateTime(quote.acceptedAt) },
                { label: "Declined", value: formatDateTime(quote.declinedAt) },
                { label: "Expires", value: formatDateTime(quote.expiresAt) },
                { label: "Archived", value: formatDateTime(quote.archivedAt) },
                { label: "Public link", value: quote.publicTokenHash ? `Issued (v${quote.publicTokenVersion})${quote.publicTokenExpiresAt ? `, valid until ${formatDateTime(quote.publicTokenExpiresAt)}` : ""}` : "Not issued" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Private content</CardTitle>
          <CardDescription>Enquiry text, notes, transcript, internal notes and the rendered quote belong to the workspace. Access requires a reason and is recorded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unlocked && expiresAt ? (
            <Alert variant="warning" title={`Unlocked until ${formatDateTime(expiresAt)}`}>
              Reason recorded: {grant?.reason}
            </Alert>
          ) : (
            <RevealPrivateContentForm quoteId={quote.id} />
          )}
          {recentAccess.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Previous support access ({recentAccess.length})</summary>
              <ul className="mt-2 divide-y text-sm">
                {recentAccess.map((a) => (
                  <li key={a.id} className="py-1.5">
                    <span className="font-medium">{a.actor?.name ?? a.actorEmail ?? "Unknown"}</span> · {formatDateTime(a.createdAt)}
                    <span className="block text-xs text-muted-foreground">{a.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </CardContent>
      </Card>

      {unlocked ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Captured inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PrivateText label="Customer enquiry" value={quote.enquiryText} />
              <PrivateText label="Job notes" value={quote.jobNotes} />
              <PrivateText label="Voice note transcript" value={quote.transcript} />
              <PrivateText label="Internal notes" value={quote.internalNotes} />
              {quote.aiAnalysis ? (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI analysis {quote.aiAnalysisAt ? `(${formatDateTime(quote.aiAnalysisAt)})` : ""}</summary>
                  <div className="mt-2">
                    <JsonBlock value={quote.aiAnalysis} maxHeight="24rem" />
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Quote document</CardTitle>
              <CardDescription>Rendered as the customer would see it (without the business logo).</CardDescription>
            </CardHeader>
            <CardContent>{document ? <QuotePreview data={document} /> : <p className="text-sm text-muted-foreground">The quote document could not be rendered (no current version or missing business settings).</p>}</CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
