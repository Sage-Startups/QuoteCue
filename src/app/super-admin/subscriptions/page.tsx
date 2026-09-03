import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { CsvExportLink } from "@/components/admin/misc";
import { ExcludeDemoToggle } from "@/components/admin/filters";
import { DemoBadge, SubscriptionStatusBadge } from "@/components/admin/badges";
import { PAGE_SIZE, excludeDemoFrom, exportQuery, maskId, pageCount, parsePage } from "../_lib/admin";
import { buildSubscriptionWhere, SUBSCRIPTION_STATUSES } from "./query";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; plan?: string; excludeDemo?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/subscriptions");
  const where = buildSubscriptionWhere(params);
  const page = parsePage(params.page);
  const [total, subs, plans] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { plan: { select: { key: true, name: true } }, workspace: { select: { id: true, name: true, isDemo: true, owner: { select: { email: true } } } } },
    }),
    prisma.plan.findMany({ where: { kind: "SUBSCRIPTION" }, orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description={`${total} subscription${total === 1 ? "" : "s"}`} actions={<CsvExportLink href={`/super-admin/subscriptions/export?${exportQuery(params)}`} />} />
      <div className="flex flex-col gap-3">
        <SearchForm
          placeholder="Search workspace, owner email or Stripe id"
          query={params.q}
          filters={[
            { name: "status", label: "Status", value: params.status, options: [{ value: "", label: "All statuses" }, ...SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") }))] },
            { name: "plan", label: "Plan", value: params.plan, options: [{ value: "", label: "All plans" }, ...plans.map((p) => ({ value: p.key, label: p.name }))] },
          ]}
        />
        <ExcludeDemoToggle excluded={excludeDemoFrom(params.excludeDemo)} />
      </div>
      {subs.length === 0 ? (
        <EmptyState icon={CreditCard} title="No subscriptions match" description="Try a different search or filter." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {subs.map((s) => (
              <Link key={s.id} href={`/super-admin/subscriptions/${s.workspaceId}`} className="block rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.workspace.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{s.workspace.owner.email}</p>
                  </div>
                  <SubscriptionStatusBadge status={s.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.plan.name} · {s.interval === "YEAR" ? "annual" : "monthly"} · ends {formatDate(s.currentPeriodEnd)}
                  {s.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                </p>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Period end</TableHead>
                  <TableHead>Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/super-admin/subscriptions/${s.workspaceId}`} className="font-semibold hover:underline">
                        {s.workspace.name}
                      </Link>{" "}
                      {s.workspace.isDemo ? <DemoBadge /> : null}
                      <span className="block text-xs text-muted-foreground">{s.workspace.owner.email}</span>
                    </TableCell>
                    <TableCell className="text-sm">{s.plan.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <SubscriptionStatusBadge status={s.status} />
                        {s.cancelAtPeriodEnd ? <Badge variant="warning">Cancels at period end</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.interval === "YEAR" ? "Annual" : "Monthly"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.currentPeriodEnd)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {maskId(s.stripeCustomerId)} / {maskId(s.stripeSubscriptionId)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/subscriptions" params={{ q: params.q, status: params.status, plan: params.plan, excludeDemo: params.excludeDemo }} />
        </>
      )}
    </div>
  );
}
