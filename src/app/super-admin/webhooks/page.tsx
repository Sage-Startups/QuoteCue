import type { Metadata } from "next";
import { Webhook, RotateCw } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader, EmptyState, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { ConfirmButton } from "@/components/app/confirm-button";
import { CsvExportLink, JsonBlock } from "@/components/admin/misc";
import { WebhookStatusBadge } from "@/components/admin/badges";
import { PAGE_SIZE, exportQuery, maskId, pageCount, parsePage } from "../_lib/admin";
import { retryWebhookAction } from "./actions";
import { buildWebhookWhere, WEBHOOK_STATUSES } from "./query";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/webhooks");
  const where = buildWebhookWhere(params);
  const page = parsePage(params.page);
  const [total, events, failed] = await Promise.all([prisma.stripeWebhookEvent.count({ where }), prisma.stripeWebhookEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }), prisma.stripeWebhookEvent.count({ where: { status: "FAILED" } })]);
  const stripeConfigured = isStripeConfigured();
  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description={`${total} Stripe event${total === 1 ? "" : "s"} · ${failed} failed`} actions={<CsvExportLink href={`/super-admin/webhooks/export?${exportQuery(params)}`} />} />
      {!stripeConfigured ? <Alert variant="warning">Stripe is not configured (mock billing). Events cannot be retried until a Stripe key is present.</Alert> : null}
      <SearchForm placeholder="Search event type, id or error" query={params.q} filters={[{ name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All statuses" }, ...WEBHOOK_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))] }]} />
      {events.length === 0 ? (
        <EmptyState icon={Webhook} title="No webhook events match" description="Stripe events appear here as they are received." />
      ) : (
        <>
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border bg-card p-4 shadow-card">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <WebhookStatusBadge status={e.status} />
                      <span className="font-mono text-sm font-semibold">{e.type}</span>
                      <Badge variant={e.livemode ? "success" : "muted"}>{e.livemode ? "live" : "test"}</Badge>
                      {e.apiVersion ? <Badge variant="outline">{e.apiVersion}</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Event <span className="font-mono">{maskId(e.stripeEventId)}</span> · received {formatDateTime(e.createdAt)}
                      {e.processedAt ? ` · processed ${formatDateTime(e.processedAt)}` : ""}
                    </p>
                    {e.error ? <p className="mt-1 break-words text-sm text-destructive">{e.error}</p> : null}
                  </div>
                  <ConfirmButton action={retryWebhookAction} hidden={{ eventId: e.id }} variant="secondary" size="sm" disabled={!stripeConfigured} confirmTitle="Retry processing this event?" confirmDescription="The event is fetched again from Stripe and processed as if it had just been received." confirmLabel="Retry">
                    <RotateCw /> Retry processing
                  </ConfirmButton>
                </div>
                {e.payloadSummary ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Payload summary</summary>
                    <div className="mt-2">
                      <JsonBlock value={e.payloadSummary} maxHeight="14rem" />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/webhooks" params={{ q: params.q, status: params.status }} />
        </>
      )}
    </div>
  );
}
