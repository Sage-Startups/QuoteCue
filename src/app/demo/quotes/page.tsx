import Link from "next/link";
import { getDemoWorkspace } from "@/lib/services/demo";
import { listQuotes } from "@/lib/services/quotes";
import { customerDisplayName } from "@/lib/services/customers";
import { STATUS_LABELS } from "@/lib/quotes/status";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import type { QuoteStatus } from "@/generated/prisma/enums";

export default async function DemoQuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const demo = (await getDemoWorkspace())!;
  const status = (params.status && params.status in STATUS_LABELS ? params.status : "ALL") as QuoteStatus | "ALL";
  const result = await listQuotes(demo.id, { search: params.q, status, page: Number(params.page ?? 1), pageSize: 20 });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Demonstration data" title="Quotes" description={`${result.total} sample quotes`} />
      <SearchForm placeholder="Search quotes" query={params.q} filters={[{ name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All" }, ...(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))] }]} />
      <div className="space-y-3 md:hidden">
        {result.items.map((q) => (
          <Link key={q.id} href={`/demo/quotes/${q.id}`} className="block rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{q.number}</p>
                <p className="truncate font-semibold">{q.title}</p>
                <p className="truncate text-sm text-muted-foreground">{q.customer ? customerDisplayName(q.customer) : "—"}</p>
              </div>
              <QuoteStatusBadge status={q.status} />
            </div>
            <p className="mt-2 text-sm font-semibold tabular">{formatMoney(q.totalMinor, q.currency)}</p>
          </Link>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <Link href={`/demo/quotes/${q.id}`} className="font-semibold hover:underline">
                    {q.number}
                  </Link>
                  <p className="text-xs text-muted-foreground">{q.title}</p>
                </TableCell>
                <TableCell>{q.customer ? customerDisplayName(q.customer) : "—"}</TableCell>
                <TableCell>
                  <QuoteStatusBadge status={q.status} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular">{formatMoney(q.totalMinor, q.currency)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{q.sentAt ? formatDate(q.sentAt) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={result.page} pages={result.pages} total={result.total} basePath="/demo/quotes" params={{ q: params.q, status: params.status }} />
    </div>
  );
}
