import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { ENTITLEMENT_KEYS, type EntitlementKey } from "@/lib/billing/plans";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { STATUS_LABELS } from "@/lib/quotes/status";
import { PageHeader, Alert, Progress } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditEntryList, DescriptionList, InlineLink, MiniStat } from "@/components/admin/misc";
import { DemoBadge, SubscriptionStatusBadge, WorkspaceStatusBadge } from "@/components/admin/badges";
import { formatBytes, formatNumber } from "@/components/admin/format";
import { isUuid } from "../../_lib/admin";
import { WorkspaceQuickActions, SupportModeForm, PromotionalCreditsForm, DeletionPanel } from "./panels";
import type { QuoteStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspaceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  await requireSuperAdminForPage(`/super-admin/workspaces/${id}`);
  if (!isUuid(id)) notFound();
  const workspace = await prisma.workspace.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      settings: true,
      members: { include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } } }, orderBy: { createdAt: "asc" } },
      subscription: { include: { plan: true } },
      _count: { select: { customers: true, catalogueItems: true, quoteTemplates: true } },
    },
  });
  if (!workspace) notFound();
  const [entitlements, quoteGroups, acceptedValue, storage, audit, supportSessions] = await Promise.all([
    getWorkspaceEntitlements(workspace.id),
    prisma.quote.groupBy({ by: ["status"], where: { workspaceId: workspace.id, deletedAt: null }, _count: { _all: true } }),
    prisma.quote.aggregate({ where: { workspaceId: workspace.id, deletedAt: null, status: "ACCEPTED" }, _sum: { totalMinor: true } }),
    prisma.storedObject.aggregate({ where: { workspaceId: workspace.id, deletedAt: null }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.adminAuditLog.findMany({ where: { targetType: "workspace", targetId: workspace.id }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true, email: true } } } }),
    prisma.supportSession.findMany({ where: { workspaceId: workspace.id }, orderBy: { startedAt: "desc" }, take: 5, include: { admin: { select: { name: true, email: true } } } }),
  ]);
  const counts = Object.fromEntries(quoteGroups.map((g) => [g.status, g._count._all])) as Partial<Record<QuoteStatus, number>>;
  const totalQuotes = quoteGroups.reduce((n, g) => n + g._count._all, 0);
  const currency = workspace.settings?.currency ?? "GBP";
  const storageBytes = storage._sum.sizeBytes ?? 0;
  const storageAllowanceBytes = entitlements.storageAllowanceMb * 1024 * 1024;
  const panelWorkspace = { id: workspace.id, name: workspace.name, slug: workspace.slug, status: workspace.status, isDemo: workspace.isDemo };
  const s = workspace.settings;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/workspaces" className="hover:underline">
            Workspaces
          </Link>
        }
        title={workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{workspace.slug}</span>
            <WorkspaceStatusBadge status={workspace.status} />
            {workspace.isDemo ? <DemoBadge /> : null}
            {workspace.subscription ? <SubscriptionStatusBadge status={workspace.subscription.status} /> : null}
          </span>
        }
        actions={<WorkspaceQuickActions workspace={panelWorkspace} />}
      />
      {query.error === "reason" ? <Alert variant="destructive">A reason of at least five characters is required to open support mode.</Alert> : null}
      {workspace.status === "SUSPENDED" ? (
        <Alert variant="destructive" title="Suspended">
          {workspace.suspendedReason ?? "No reason recorded."}
        </Alert>
      ) : null}
      {workspace.status === "PENDING_DELETION" ? (
        <Alert variant="warning" title={`Deletion requested ${workspace.deletionRequestedAt ? formatDateTime(workspace.deletionRequestedAt) : ""}`}>
          Members cannot access this workspace. Cancel the deletion below to restore it, or delete it now.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Business settings</CardTitle>
          </CardHeader>
          <CardContent>
            {s ? (
              <DescriptionList
                items={[
                  { label: "Business name", value: s.businessName },
                  { label: "Trade", value: s.tradeSlug },
                  { label: "Contact", value: [s.contactName, s.email, s.phone].filter(Boolean).join(" · ") || "—" },
                  { label: "Location", value: [s.city, s.region, s.country].filter(Boolean).join(", ") || "—" },
                  { label: "Currency / tax", value: `${s.currency} · ${s.taxMode === "NONE" ? "No tax" : `${s.taxLabel} ${(s.taxRateBps / 100).toFixed(1)}%`} · ${s.pricingMode.toLowerCase().replace("_", " ")}` },
                  { label: "Labour rate", value: `${formatMoney(s.labourRateMinor, s.currency)} / ${s.labourRateUnit.toLowerCase()}` },
                  { label: "Quote validity", value: `${s.quoteValidityDays} days` },
                  { label: "Quote prefix", value: s.quoteNumberPrefix },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Onboarding not completed: no business settings yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Owner and account</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Owner", value: <InlineLink href={`/super-admin/users/${workspace.owner.id}`}>{workspace.owner.name}</InlineLink> },
                { label: "Owner email", value: workspace.owner.email },
                { label: "Workspace id", value: <span className="font-mono text-xs">{workspace.id}</span> },
                { label: "Created", value: formatDateTime(workspace.createdAt) },
                { label: "Customers", value: workspace._count.customers },
                { label: "Catalogue items", value: workspace._count.catalogueItems },
                { label: "Quote templates", value: workspace._count.quoteTemplates },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plan and entitlements</CardTitle>
            <CardDescription>
              <InlineLink href={`/super-admin/subscriptions/${workspace.id}`}>Manage subscription</InlineLink>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DescriptionList
              items={[
                { label: "Plan", value: `${entitlements.planName} (${entitlements.status.toLowerCase()})` },
                { label: "Interval", value: entitlements.interval === "YEAR" ? "Annual" : "Monthly" },
                { label: "Period", value: `${formatDate(entitlements.currentPeriodStart)} – ${formatDate(entitlements.currentPeriodEnd)}` },
                { label: "Paid features", value: <Badge variant={entitlements.paidFeaturesActive ? "success" : "muted"}>{entitlements.paidFeaturesActive ? "Active" : "Inactive"}</Badge> },
                { label: "Cancel at period end", value: entitlements.cancelAtPeriodEnd ? "Yes" : "No" },
              ]}
            />
            <div className="flex flex-wrap gap-1">
              {(Object.keys(ENTITLEMENT_KEYS) as EntitlementKey[]).map((k) => (
                <Badge key={k} variant={entitlements.features[k] ? "success" : "muted"} title={ENTITLEMENT_KEYS[k]}>
                  {k.toLowerCase().replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotas and usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="AI allowance" value={`${entitlements.usedThisPeriod} / ${entitlements.allowancePerPeriod}`} hint="Used this period" />
              <MiniStat label="Credit balance" value={entitlements.creditBalance} hint={`${entitlements.totalAvailable} generations available`} />
              <MiniStat label="Members" value={`${entitlements.memberCount} / ${entitlements.maxMembers}`} />
              <MiniStat label="Storage" value={formatBytes(storageBytes)} hint={`${formatNumber(storage._count._all)} objects · ${entitlements.storageAllowanceMb} MB allowance`} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Storage used against plan allowance</p>
              <Progress value={storageBytes} max={storageAllowanceBytes || 1} label="Storage used" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quote statistics</CardTitle>
            <CardDescription>
              {totalQuotes} quote{totalQuotes === 1 ? "" : "s"} · accepted value {formatMoney(acceptedValue._sum.totalMinor ?? 0, currency)}.{" "}
              <InlineLink href={`/super-admin/quotes?q=${encodeURIComponent(workspace.slug)}&excludeDemo=0`}>View quotes</InlineLink>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((status) => (
                <MiniStat key={status} label={STATUS_LABELS[status]} value={counts[status] ?? 0} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link href={`/super-admin/users/${m.user.id}`} className="font-semibold hover:underline">
                      {m.user.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{m.user.email}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.user.id === workspace.ownerId ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.user.lastLoginAt ? formatDateTime(m.user.lastLoginAt) : "Never"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Support mode</CardTitle>
            <CardDescription>Open the workspace in the app as a read-only support session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SupportModeForm workspace={panelWorkspace} />
            {supportSessions.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent support sessions</p>
                <ul className="mt-1 divide-y text-sm">
                  {supportSessions.map((ss) => (
                    <li key={ss.id} className="py-1.5">
                      <span className="font-medium">{ss.admin.name}</span> · {formatDateTime(ss.startedAt)} {ss.endedAt ? `· ended ${formatDateTime(ss.endedAt)}` : ss.expiresAt > new Date() ? "· active" : "· expired"}
                      <span className="block text-xs text-muted-foreground">{ss.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Grant promotional credits</CardTitle>
            <CardDescription>Adds AI generation credits that never expire. Current balance: {workspace.aiCreditBalance}.</CardDescription>
          </CardHeader>
          <CardContent>
            <PromotionalCreditsForm workspace={panelWorkspace} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit history</CardTitle>
          <CardDescription>Admin actions targeting this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditEntryList entries={audit} currentTargetId={workspace.id} formatDateTime={formatDateTime} />
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Start a deletion (members lose access, data retained) or delete the workspace and all of its data immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeletionPanel workspace={panelWorkspace} />
        </CardContent>
      </Card>
    </div>
  );
}
