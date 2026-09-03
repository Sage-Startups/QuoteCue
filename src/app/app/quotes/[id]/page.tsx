import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, FileDown, Copy, GitBranch, Archive, RotateCcw, Mail, Link2, RefreshCw, Undo2 } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getQuote, getQuoteEvents, getQuoteEmailEvents } from "@/lib/services/quotes";
import { buildQuoteDocument } from "@/lib/services/quote-document";
import { ensurePublicLink } from "@/lib/services/public-quote";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { getEnv } from "@/lib/env";
import { customerDisplayName } from "@/lib/services/customers";
import { isEditable } from "@/lib/quotes/status";
import { formatMoney } from "@/lib/utils/money";
import { formatDate, formatDateTime, toDateInputValue, addDays } from "@/lib/utils/dates";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { ActivityFeed } from "@/components/app/activity-feed";
import { ConfirmButton } from "@/components/app/confirm-button";
import { QuotePreview } from "@/components/quotes/quote-preview";
import { QuoteDetailActions } from "@/components/quotes/quote-detail-actions";
import { archiveQuoteAction, restoreQuoteAction, duplicateQuoteAction, createRevisionAction, reactivateQuoteAction, returnToDraftAction } from "../actions";

export const metadata: Metadata = { title: "Quote" };

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspaceForPage(`/app/quotes/${id}`);
  const quote = await getQuote(ctx.workspace.id, id).catch(() => null);
  if (!quote) notFound();
  const [document, events, emails, entitlements] = await Promise.all([
    buildQuoteDocument(ctx.workspace.id, id),
    getQuoteEvents(ctx.workspace.id, id),
    getQuoteEmailEvents(ctx.workspace.id, id),
    getWorkspaceEntitlements(ctx.workspace.id),
  ]);
  const publicLink = ["SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"].includes(quote.status) ? await ensurePublicLink(ctx.workspace.id, id) : null;
  const readOnly = !!ctx.supportSession;
  const editable = isEditable(quote.status) && !readOnly;
  const locked = quote.currentVersion?.isLocked ?? false;
  const env = getEnv();
  const customerName = quote.customer ? customerDisplayName(quote.customer) : "No customer";
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={quote.number}
        title={quote.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} />
            <span>
              {customerName} · {formatMoney(quote.totalMinor, quote.currency)}
            </span>
            {quote.currentVersion && quote.currentVersion.versionNumber > 1 ? <Badge variant="outline">Revision {quote.currentVersion.versionNumber}</Badge> : null}
            {locked ? <Badge variant="success">Accepted version locked</Badge> : null}
          </span>
        }
        actions={
          <>
            {editable && !locked ? (
              <Button asChild>
                <Link href={`/app/quotes/${id}/edit?step=${Math.max(1, Math.min(6, quote.wizardStep))}`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            ) : null}
            {entitlements.features.PDF_DOWNLOAD ? (
              <Button asChild variant="secondary">
                <a href={`/app/quotes/${id}/pdf?download=1`}>
                  <FileDown /> PDF
                </a>
              </Button>
            ) : null}
          </>
        }
      />
      {quote.status === "EXPIRED" ? (
        <Alert variant="warning" title="This quote has expired">
          The customer can still read it but cannot accept it. Reactivate it with a new expiry date to reopen acceptance.
        </Alert>
      ) : null}
      {quote.status === "ACCEPTED" ? (
        <Alert variant="success" title="Accepted">
          Accepted on {formatDateTime(quote.acceptedAt)}. This version is preserved; create a revision to make changes.
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="activity">Activity ({events.length})</TabsTrigger>
              <TabsTrigger value="emails">Emails ({emails.length})</TabsTrigger>
              <TabsTrigger value="versions">Versions ({quote.versions.length})</TabsTrigger>
              <TabsTrigger value="inputs">Inputs</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <QuotePreview data={document} />
            </TabsContent>
            <TabsContent value="activity">
              <Card>
                <CardContent className="pt-5">
                  <ActivityFeed showQuote={false} items={events.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt, actorName: e.actorUser?.name ?? (e.actorType === "CUSTOMER" ? "Customer" : e.actorType === "SYSTEM" ? "System" : null) }))} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="emails">
              <Card>
                <CardContent className="pt-5">
                  {emails.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No emails sent for this quote yet.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {emails.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span>
                            <span className="font-medium">{e.subject}</span>
                            <span className="block text-xs text-muted-foreground">
                              to {e.toEmail} · {formatDateTime(e.createdAt)} · {e.provider}
                            </span>
                            {e.error ? <span className="block text-xs text-destructive">{e.error}</span> : null}
                          </span>
                          <Badge variant={e.status === "SENT" || e.status === "DELIVERED" ? "success" : e.status === "PREVIEW" ? "warning" : e.status === "FAILED" ? "destructive" : "muted"}>{e.status.toLowerCase()}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="versions">
              <Card>
                <CardContent className="pt-5">
                  <ul className="divide-y text-sm">
                    {quote.versions.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <span className="font-medium">
                            Version {v.versionNumber}
                            {v.id === quote.currentVersionId ? " (current)" : ""}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {v.title} · created {formatDateTime(v.createdAt)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular">{formatMoney(v.totalMinor, quote.currency)}</span>
                          {v.isLocked ? <Badge variant="success">Accepted · locked</Badge> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {quote.acceptances.length > 0 ? (
                    <div className="mt-4 border-t pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer decisions</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {quote.acceptances.map((a) => (
                          <li key={a.id}>
                            <Badge variant={a.decision === "ACCEPTED" ? "success" : "destructive"}>{a.decision.toLowerCase()}</Badge> {formatDateTime(a.createdAt)}
                            {a.signedName ? ` · signed ${a.signedName}` : ""}
                            {a.reason ? ` · ${a.reason}` : ""} · {formatMoney(a.totalMinor, quote.currency)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="inputs">
              <Card>
                <CardContent className="space-y-4 pt-5 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer message</p>
                    <p className="whitespace-pre-wrap">{quote.enquiryText ?? <span className="text-muted-foreground">None</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job notes</p>
                    <p className="whitespace-pre-wrap">{quote.jobNotes ?? <span className="text-muted-foreground">None</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
                    <p className="whitespace-pre-wrap">{quote.transcript ?? <span className="text-muted-foreground">None</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal notes</p>
                    <p className="whitespace-pre-wrap">{quote.internalNotes ?? <span className="text-muted-foreground">None</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</p>
                    {quote.media.length === 0 ? <p className="text-muted-foreground">None</p> : <p>{quote.media.map((m) => `${m.kind.toLowerCase()}: ${m.storedObject.originalFilename ?? "file"}`).join(" · ")}</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Row label="Customer" value={quote.customer ? <Link href={`/app/customers/${quote.customer.id}`} className="underline">{customerName}</Link> : "—"} />
              <Row label="Created" value={formatDate(quote.createdAt)} />
              <Row label="Sent" value={quote.sentAt ? formatDateTime(quote.sentAt) : "—"} />
              <Row label="First viewed" value={quote.firstViewedAt ? `${formatDateTime(quote.firstViewedAt)} (${quote.viewCount} view${quote.viewCount === 1 ? "" : "s"})` : "—"} />
              <Row label="Expires" value={formatDate(quote.expiresAt)} />
              <Row label="Follow up" value={quote.followUpAt ? formatDate(quote.followUpAt) : "—"} />
              <Row label="Total" value={<strong>{formatMoney(quote.totalMinor, quote.currency)}</strong>} />
              {quote.currentVersion ? <Row label="Margin" value={`${formatMoney(quote.currentVersion.totalMinor - quote.currentVersion.taxMinor - quote.currentVersion.internalCostMinor, quote.currency)} (internal)`} /> : null}
              <Row label="Created by" value={quote.createdBy?.name ?? "—"} />
            </CardContent>
          </Card>
          {!readOnly ? (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <QuoteDetailActions quoteId={id} status={quote.status} customerEmail={quote.customer?.email ?? ""} followUpEmail={quote.currentVersion?.followUpEmail ?? ""} emailPreviewMode={env.providers.email === "preview"} publicUrl={publicLink?.url ?? null} canSend={!!quote.customerId && (quote.currentVersion?.items.length ?? 0) > 0 && entitlements.features.ACCEPTANCE_LINKS} />
                {quote.status === "EXPIRED" ? (
                  <ConfirmButton action={reactivateQuoteAction} hidden={{ id, expiresAt: toDateInputValue(addDays(new Date(), 14)) }} variant="secondary" confirmTitle="Reactivate quote?" confirmDescription="The quote will be valid for another 14 days and the customer can accept it again." confirmLabel="Reactivate">
                    <RefreshCw /> Reactivate (14 days)
                  </ConfirmButton>
                ) : null}
                {(quote.status === "SENT" || quote.status === "VIEWED" || quote.status === "READY" || quote.status === "DECLINED") && !locked ? (
                  <ConfirmButton action={returnToDraftAction} hidden={{ id }} variant="ghost" confirmTitle="Return to draft?" confirmDescription="The customer link keeps working but the quote is marked as a draft again.">
                    <Undo2 /> Return to draft
                  </ConfirmButton>
                ) : null}
                <ConfirmButton action={duplicateQuoteAction} hidden={{ id }} variant="secondary" onSuccess={undefined} redirectTo={undefined} successMessage="Quote duplicated">
                  <Copy /> Duplicate quote
                </ConfirmButton>
                {quote.status !== "ARCHIVED" ? (
                  <ConfirmButton action={createRevisionAction} hidden={{ id }} variant="secondary" confirmTitle="Create a revision?" confirmDescription={locked ? "The accepted version is preserved and locked. A new editable version is created and the quote returns to draft." : "A new version is created from the current one and the quote returns to draft."} confirmLabel="Create revision" redirectTo={`/app/quotes/${id}/edit?step=4`}>
                    <GitBranch /> Create revision
                  </ConfirmButton>
                ) : null}
                {quote.status === "ARCHIVED" ? (
                  <ConfirmButton action={restoreQuoteAction} hidden={{ id }} variant="secondary">
                    <RotateCcw /> Restore
                  </ConfirmButton>
                ) : (
                  <ConfirmButton action={archiveQuoteAction} hidden={{ id }} variant="ghost" confirmTitle="Archive quote?" confirmDescription="Archived quotes are hidden from the main list and the customer link stops working. You can restore it later." confirmLabel="Archive">
                    <Archive /> Archive
                  </ConfirmButton>
                )}
              </CardContent>
            </Card>
          ) : null}
          {publicLink ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="size-4" /> Customer link
                </CardTitle>
                <CardDescription>Valid until {formatDate(publicLink.expiresAt)}.</CardDescription>
              </CardHeader>
              <CardContent>
                <input readOnly value={publicLink.url} className="h-9 w-full rounded-lg border bg-muted px-2 font-mono text-xs" aria-label="Customer link" />
                <a href={publicLink.url} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline">
                  <Mail className="size-3" /> Open customer view
                </a>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </p>
  );
}
