import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { STATUS_LABELS } from "@/lib/quotes/status";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { CsvExportLink } from "@/components/admin/misc";
import { ExcludeDemoToggle } from "@/components/admin/filters";
import { DemoBadge } from "@/components/admin/badges";
import { PAGE_SIZE, excludeDemoFrom, exportQuery, pageCount, parsePage } from "../_lib/admin";
import { buildQuoteWhere, QUOTE_STATUSES } from "./query";
import type { QuoteStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Quotes" };

const STATUS_VARIANT: Record<QuoteStatus, "muted" | "info" | "success" | "destructive" | "warning" | "outline"> = { DRAFT: "muted", READY: "outline", SENT: "info", VIEWED: "warning", ACCEPTED: "success", DECLINED: "destructive", EXPIRED: "muted", ARCHIVED: "muted" };

export default async function QuotesAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; excludeDemo?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/quotes");
  const where = buildQuoteWhere(params);
  const page = parsePage(params.page);
  const [total, quotes] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, number: true, title: true, status: true, currency: true, totalMinor: true, createdAt: true, sentAt: true, acceptedAt: true, expiresAt: true, workspace: { select: { id: true, name: true, isDemo: true } } },
    }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description={`${total} quote${total === 1 ? "" : "s"} across all workspaces. Only metadata is shown; private content requires a recorded reason.`} actions={<CsvExportLink href={`/super-admin/quotes/export?${exportQuery(params)}`} />} />
      <div className="flex flex-col gap-3">
        <SearchForm placeholder="Search quote number, title or workspace" query={params.q} filters={[{ name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All statuses" }, ...QUOTE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))] }]} />
        <ExcludeDemoToggle excluded={excludeDemoFrom(params.excludeDemo)} />
      </div>
      {quotes.length === 0 ? (
        <EmptyState icon={FileText} title="No quotes match" description="Try a different search or filter." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {quotes.map((q) => (
              <Link key={q.id} href={`/super-admin/quotes/${q.id}`} className="block rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{q.number}</p>
                    <p className="truncate font-semibold">{q.title}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[q.status]}>{STATUS_LABELS[q.status]}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {q.workspace.name} · {formatMoney(q.totalMinor, q.currency)} · {formatDate(q.createdAt)}
                </p>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/super-admin/quotes/${q.id}`} className="font-semibold hover:underline">
                        {q.title}
                      </Link>
                      <span className="block font-mono text-xs text-muted-foreground">{q.number}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link href={`/super-admin/workspaces/${q.workspace.id}`} className="hover:underline">
                        {q.workspace.name}
                      </Link>{" "}
                      {q.workspace.isDemo ? <DemoBadge /> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[q.status]}>{STATUS_LABELS[q.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatMoney(q.totalMinor, q.currency)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.sentAt ? formatDate(q.sentAt) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.expiresAt ? formatDate(q.expiresAt) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/quotes" params={{ q: params.q, status: params.status, excludeDemo: params.excludeDemo }} />
        </>
      )}
    </div>
  );
}
