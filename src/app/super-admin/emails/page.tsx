import type { Metadata } from "next";
import Link from "next/link";
import { Mail, FileText } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_KINDS } from "@/lib/email/templates";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { DateRangeFilter } from "@/components/app/date-range-filter";
import { CsvExportLink, HtmlPreview } from "@/components/admin/misc";
import { EmailStatusBadge } from "@/components/admin/badges";
import { formatNumber, percent } from "@/components/admin/format";
import { resolveDateRange } from "@/lib/utils/dates";
import { PAGE_SIZE, exportQuery, pageCount, parsePage } from "../_lib/admin";
import { buildEmailWhere, EMAIL_STATUSES } from "./query";

export const metadata: Metadata = { title: "Email activity" };

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; status?: string; range?: string; from?: string; to?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/emails");
  const range = resolveDateRange(params.range, params.from, params.to);
  const where = buildEmailWhere(params);
  const page = parsePage(params.page);
  const rangeWhere = { createdAt: { gte: range.from, lte: range.to } };
  const [total, events, sent, failed, preview, skipped] = await Promise.all([
    prisma.emailEvent.count({ where }),
    prisma.emailEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { workspace: { select: { id: true, name: true } } } }),
    prisma.emailEvent.count({ where: { ...rangeWhere, status: { in: ["SENT", "DELIVERED"] } } }),
    prisma.emailEvent.count({ where: { ...rangeWhere, status: "FAILED" } }),
    prisma.emailEvent.count({ where: { ...rangeWhere, status: "PREVIEW" } }),
    prisma.emailEvent.count({ where: { ...rangeWhere, status: "SKIPPED" } }),
  ]);
  const attempted = sent + failed;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Email activity"
        description="Every email the platform has rendered, with delivery status."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/super-admin/emails/templates">
                <FileText /> Edit templates
              </Link>
            </Button>
            <CsvExportLink href={`/super-admin/emails/export?${exportQuery(params)}`} />
          </>
        }
      />
      <DateRangeFilter current={range.key} from={params.from} to={params.to} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sent" value={formatNumber(sent)} hint={`${percent(sent, attempted)} delivery rate`} icon={Mail} />
        <StatCard label="Failed" value={formatNumber(failed)} hint={`${percent(failed, attempted)} of attempts`} />
        <StatCard label="Preview (not delivered)" value={formatNumber(preview)} hint="Preview provider in development" />
        <StatCard label="Skipped" value={formatNumber(skipped)} hint="Template disabled" />
      </div>
      <SearchForm
        placeholder="Search recipient or subject"
        query={params.q}
        filters={[
          { name: "kind", label: "Kind", value: params.kind, options: [{ value: "", label: "All kinds" }, ...EMAIL_KINDS.map((k) => ({ value: k, label: DEFAULT_EMAIL_TEMPLATES[k].name }))] },
          { name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All statuses" }, ...EMAIL_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))] },
        ]}
      />
      {events.length === 0 ? (
        <EmptyState icon={Mail} title="No emails match" description="Try a different search or filter." />
      ) : (
        <>
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border bg-card p-4 shadow-card">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EmailStatusBadge status={e.status} />
                      <Badge variant="outline">{DEFAULT_EMAIL_TEMPLATES[e.kind].name}</Badge>
                      <Badge variant="muted">{e.provider}</Badge>
                    </div>
                    <p className="mt-1.5 break-words font-semibold">{e.subject}</p>
                    <p className="break-all text-sm text-muted-foreground">
                      To {e.toEmail}
                      {e.workspace ? (
                        <>
                          {" · "}
                          <Link href={`/super-admin/workspaces/${e.workspace.id}`} className="hover:underline">
                            {e.workspace.name}
                          </Link>
                        </>
                      ) : null}
                      {e.quoteId ? (
                        <>
                          {" · "}
                          <Link href={`/super-admin/quotes/${e.quoteId}`} className="hover:underline">
                            quote
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {e.error ? <p className="mt-1 text-sm text-destructive">{e.error}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                </div>
                {e.htmlPreview ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Preview rendered email</summary>
                    <div className="mt-2">
                      <HtmlPreview html={e.htmlPreview} title={`Preview of ${e.subject}`} />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/emails" params={{ q: params.q, kind: params.kind, status: params.status, range: params.range, from: params.from, to: params.to }} />
        </>
      )}
    </div>
  );
}
