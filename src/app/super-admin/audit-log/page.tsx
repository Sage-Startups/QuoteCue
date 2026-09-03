import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/app/pagination";
import { CsvExportLink, JsonBlock } from "@/components/admin/misc";
import { PAGE_SIZE, exportQuery, pageCount, parsePage } from "../_lib/admin";
import { AuditFilters } from "./filters";
import { RollbackButton } from "./rollback-button";
import { buildAuditWhere, ROLLBACK_ACTIONS } from "./query";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; targetType?: string; from?: string; to?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/audit-log");
  const where = buildAuditWhere(params);
  const page = parsePage(params.page);
  const [total, entries, targetTypes] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { actor: { select: { name: true, email: true } } } }),
    prisma.adminAuditLog.findMany({ distinct: ["targetType"], select: { targetType: true }, orderBy: { targetType: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description={`${total} entr${total === 1 ? "y" : "ies"}. Every admin action with actor, target, reason and before/after values.`} actions={<CsvExportLink href={`/super-admin/audit-log/export?${exportQuery(params)}`} />} />
      <AuditFilters values={params} targetTypes={targetTypes.map((t) => t.targetType)} />
      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries match" description="Try a different filter." />
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((a) => {
              const canRollback = (ROLLBACK_ACTIONS as readonly string[]).includes(a.action) && a.previousValue !== null;
              return (
                <li key={a.id} className="rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{a.action}</Badge>
                        <Badge variant="muted">{a.targetType}</Badge>
                        {a.targetId ? <span className="font-mono text-xs text-muted-foreground">{a.targetId}</span> : null}
                      </div>
                      <p className="mt-1 text-sm">
                        <span className="font-medium">{a.actor?.name ?? a.actorEmail ?? "system"}</span>
                        {a.actor?.email && a.actor.email !== a.actorEmail ? <span className="text-muted-foreground"> ({a.actor.email})</span> : a.actorEmail && a.actor?.name ? <span className="text-muted-foreground"> ({a.actorEmail})</span> : null}
                        {a.reason ? <span className="text-muted-foreground"> · {a.reason}</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                      {canRollback ? <RollbackButton entryId={a.id} target={a.targetId ?? a.targetType} /> : null}
                    </div>
                  </div>
                  {a.previousValue !== null || a.newValue !== null ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Previous and new values</summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Previous</p>
                          <JsonBlock value={a.previousValue} maxHeight="14rem" />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">New</p>
                          <JsonBlock value={a.newValue} maxHeight="14rem" />
                        </div>
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/audit-log" params={{ action: params.action, actor: params.actor, targetType: params.targetType, from: params.from, to: params.to }} />
        </>
      )}
    </div>
  );
}
