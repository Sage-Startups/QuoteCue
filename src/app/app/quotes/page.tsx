import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { listQuotes } from "@/lib/services/quotes";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";
import { customerDisplayName } from "@/lib/services/customers";
import { STATUS_LABELS } from "@/lib/quotes/status";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { QuoteListClient } from "@/components/quotes/quote-list-client";
import type { QuoteStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; customerId?: string; from?: string; to?: string; sort?: string; page?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app/quotes");
  const status = (params.status && params.status in STATUS_LABELS ? params.status : params.status === "OPEN" ? "OPEN" : "ALL") as QuoteStatus | "ALL" | "OPEN";
  const sort = (["newest", "oldest", "value_desc", "value_asc", "expiry"].includes(params.sort ?? "") ? params.sort : "newest") as "newest" | "oldest" | "value_desc" | "value_asc" | "expiry";
  const [result, customers, entitlements] = await Promise.all([
    listQuotes(ctx.workspace.id, { search: params.q, status, customerId: params.customerId, from: params.from, to: params.to, sort, page: Number(params.page ?? 1), includeArchived: status === "ARCHIVED" }),
    prisma.customer.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, orderBy: { contactName: "asc" }, select: { id: true, contactName: true, companyName: true }, take: 200 }),
    getWorkspaceEntitlements(ctx.workspace.id),
  ]);
  const exportQuery = new URLSearchParams();
  for (const [k, v] of Object.entries({ q: params.q, status: params.status, customerId: params.customerId, from: params.from, to: params.to })) if (v) exportQuery.set(k, v);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        description={`${result.total} quote${result.total === 1 ? "" : "s"}`}
        actions={
          <>
            {entitlements.features.CSV_EXPORT ? (
              <Button asChild variant="secondary">
                <a href={`/app/quotes/export?${exportQuery.toString()}`}>
                  <Download /> Export CSV
                </a>
              </Button>
            ) : null}
            {!ctx.supportSession ? (
              <Button asChild variant="accent">
                <Link href="/app/quotes/new">New quote</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <SearchForm
        placeholder="Search number, title, reference or customer"
        query={params.q}
        filters={[
          { name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All active" }, { value: "OPEN", label: "Awaiting decision" }, ...(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))] },
          { name: "customerId", label: "Customer", value: params.customerId, options: [{ value: "", label: "All customers" }, ...customers.map((c) => ({ value: c.id, label: customerDisplayName(c) }))] },
          { name: "sort", label: "Sort", value: params.sort, options: [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "value_desc", label: "Highest value" }, { value: "value_asc", label: "Lowest value" }, { value: "expiry", label: "Expiring soonest" }] },
        ]}
      />
      <div className="flex flex-wrap items-end gap-2 text-xs text-muted-foreground">
        <form className="flex flex-wrap items-end gap-2" method="get">
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          {params.customerId ? <input type="hidden" name="customerId" value={params.customerId} /> : null}
          <label className="flex flex-col gap-1">
            Created from
            <input type="date" name="from" defaultValue={params.from} className="h-9 rounded-lg border border-input bg-white px-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            to
            <input type="date" name="to" defaultValue={params.to} className="h-9 rounded-lg border border-input bg-white px-2 text-sm" />
          </label>
          <Button type="submit" size="sm" variant="outline">
            Filter dates
          </Button>
          {params.from || params.to ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/quotes">Clear</Link>
            </Button>
          ) : null}
        </form>
      </div>
      {result.items.length === 0 ? (
        <EmptyState icon={FileText} title={params.q || params.status ? "No quotes match" : "No quotes yet"} description={params.q || params.status ? "Try a different search or filter." : "Create your first quote from a customer message, voice note or photos."} action={!ctx.supportSession ? { label: "New quote", href: "/app/quotes/new" } : undefined} />
      ) : (
        <>
          <QuoteListClient
            readOnly={!!ctx.supportSession}
            rows={result.items.map((q) => ({
              id: q.id,
              number: q.number,
              title: q.title,
              status: q.status,
              totalMinor: q.totalMinor,
              currency: q.currency,
              customerName: q.customer ? customerDisplayName(q.customer) : "No customer",
              createdAt: q.createdAt.toISOString(),
              sentAt: q.sentAt?.toISOString() ?? null,
              expiresAt: q.expiresAt?.toISOString() ?? null,
              updatedAt: q.updatedAt.toISOString(),
            }))}
          />
          <Pagination page={result.page} pages={result.pages} total={result.total} basePath="/app/quotes" params={{ q: params.q, status: params.status, customerId: params.customerId, from: params.from, to: params.to, sort: params.sort }} />
        </>
      )}
    </div>
  );
}
