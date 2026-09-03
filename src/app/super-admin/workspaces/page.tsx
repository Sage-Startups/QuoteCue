import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { CsvExportLink } from "@/components/admin/misc";
import { ExcludeDemoToggle } from "@/components/admin/filters";
import { DemoBadge, SubscriptionStatusBadge, WorkspaceStatusBadge } from "@/components/admin/badges";
import { PAGE_SIZE, excludeDemoFrom, exportQuery, pageCount, parsePage } from "../_lib/admin";
import { buildWorkspaceWhere } from "./query";

export const metadata: Metadata = { title: "Workspaces" };

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; excludeDemo?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/workspaces");
  const where = buildWorkspaceWhere(params);
  const page = parsePage(params.page);
  const [total, workspaces] = await Promise.all([
    prisma.workspace.count({ where }),
    prisma.workspace.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isDemo: true,
        aiCreditBalance: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
        subscription: { select: { status: true, plan: { select: { name: true } } } },
        _count: { select: { members: true, quotes: true } },
      },
    }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Workspaces" description={`${total} workspace${total === 1 ? "" : "s"}`} actions={<CsvExportLink href={`/super-admin/workspaces/export?${exportQuery(params)}`} />} />
      <div className="flex flex-col gap-3">
        <SearchForm
          placeholder="Search name, slug or owner email"
          query={params.q}
          filters={[{ name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "SUSPENDED", label: "Suspended" }, { value: "PENDING_DELETION", label: "Pending deletion" }] }]}
        />
        <ExcludeDemoToggle excluded={excludeDemoFrom(params.excludeDemo)} />
      </div>
      {workspaces.length === 0 ? (
        <EmptyState icon={Building2} title="No workspaces match" description="Try a different search or filter." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {workspaces.map((w) => (
              <Link key={w.id} href={`/super-admin/workspaces/${w.id}`} className="block rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{w.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{w.owner.email}</p>
                  </div>
                  <WorkspaceStatusBadge status={w.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {w.subscription ? <SubscriptionStatusBadge status={w.subscription.status} /> : null}
                  {w.isDemo ? <DemoBadge /> : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {w.subscription?.plan.name ?? "No plan"} · {w._count.members} member{w._count.members === 1 ? "" : "s"} · {w._count.quotes} quote{w._count.quotes === 1 ? "" : "s"} · created {formatDate(w.createdAt)}
                </p>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link href={`/super-admin/workspaces/${w.id}`} className="font-semibold hover:underline">
                        {w.name}
                      </Link>{" "}
                      {w.isDemo ? <DemoBadge /> : null}
                      <span className="block font-mono text-xs text-muted-foreground">{w.slug}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link href={`/super-admin/users/${w.owner.id}`} className="hover:underline">
                        {w.owner.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{w.owner.email}</span>
                    </TableCell>
                    <TableCell>
                      <WorkspaceStatusBadge status={w.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {w.subscription ? (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {w.subscription.plan.name} <SubscriptionStatusBadge status={w.subscription.status} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular">{w._count.members}</TableCell>
                    <TableCell className="text-right tabular">{w._count.quotes}</TableCell>
                    <TableCell className="text-right tabular">{w.aiCreditBalance}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(w.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/workspaces" params={{ q: params.q, status: params.status, excludeDemo: params.excludeDemo }} />
        </>
      )}
    </div>
  );
}
