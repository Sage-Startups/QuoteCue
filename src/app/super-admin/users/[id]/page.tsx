import type { Metadata } from "next";
import { timeAgo } from "@/components/admin/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatRelative } from "@/lib/utils/dates";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DescriptionList, JsonBlock } from "@/components/admin/misc";
import { DemoBadge, PlatformRoleBadge, WorkspaceStatusBadge } from "@/components/admin/badges";
import { UserQuickActions, RoleForm, GrantCreditsForm, ComplimentaryPlanForm, DeleteUserPanel } from "./panels";

export const metadata: Metadata = { title: "User" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireSuperAdminForPage(`/super-admin/users/${id}`);
  if (!UUID.test(id)) notFound();
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      memberships: { include: { workspace: { select: { id: true, name: true, status: true, isDemo: true, ownerId: true, aiCreditBalance: true, subscription: { select: { status: true, plan: { select: { name: true } } } } } } }, orderBy: { createdAt: "asc" } },
      _count: { select: { sessions: true, aiRuns: true, quotesCreated: true } },
    },
  });
  if (!user) notFound();
  const [audit, plans, recentRuns] = await Promise.all([
    prisma.adminAuditLog.findMany({ where: { OR: [{ targetType: "user", targetId: user.id }, { actorUserId: user.id }] }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true, email: true } } } }),
    prisma.plan.findMany({ where: { kind: "SUBSCRIPTION", isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.aiRun.count({ where: { userId: user.id, startedAt: { gte: timeAgo(30 * 86_400_000) } } }),
  ]);
  const panelUser = { id: user.id, email: user.email, platformRole: user.platformRole, suspended: !!user.suspendedAt, isSelf: user.id === admin.user.id };
  const workspaces = user.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, isDemo: m.workspace.isDemo }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/users" className="hover:underline">
            Users
          </Link>
        }
        title={user.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            <PlatformRoleBadge role={user.platformRole} />
            <Badge variant={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? "Verified" : "Unverified"}</Badge>
            {user.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : null}
          </span>
        }
        actions={<UserQuickActions user={panelUser} />}
      />
      {user.suspendedAt ? (
        <Alert variant="destructive" title={`Suspended ${formatDateTime(user.suspendedAt)}`}>
          {user.suspendedReason ?? "No reason recorded."}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "User id", value: <span className="font-mono text-xs">{user.id}</span> },
                { label: "Created", value: formatDateTime(user.createdAt) },
                { label: "Last login", value: user.lastLoginAt ? `${formatDateTime(user.lastLoginAt)} (${formatRelative(user.lastLoginAt)})` : "Never" },
                { label: "Onboarding", value: user.onboardingCompletedAt ? `Completed ${formatDate(user.onboardingCompletedAt)}` : "Not completed" },
                { label: "Locale", value: user.locale },
                { label: "Active sessions", value: user._count.sessions },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "AI runs (all time)", value: user._count.aiRuns },
                { label: "AI runs (30 days)", value: recentRuns },
                { label: "Quotes created", value: user._count.quotesCreated },
                { label: "Workspaces", value: user.memberships.length },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Platform role</CardTitle>
            <CardDescription>Support admins can view support tooling; super admins have full access.</CardDescription>
          </CardHeader>
          <CardContent>
            <RoleForm user={panelUser} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace memberships</CardTitle>
        </CardHeader>
        <CardContent>
          {user.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspace memberships.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.memberships.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link href={`/super-admin/workspaces/${m.workspace.id}`} className="font-semibold hover:underline">
                        {m.workspace.name}
                      </Link>{" "}
                      {m.workspace.isDemo ? <DemoBadge /> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.workspace.ownerId === user.id ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}</Badge>
                    </TableCell>
                    <TableCell>
                      <WorkspaceStatusBadge status={m.workspace.status} />
                    </TableCell>
                    <TableCell className="text-sm">{m.workspace.subscription ? `${m.workspace.subscription.plan.name} (${m.workspace.subscription.status.toLowerCase()})` : "—"}</TableCell>
                    <TableCell className="text-right tabular">{m.workspace.aiCreditBalance}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Grant AI credits</CardTitle>
            <CardDescription>Adds or removes purchased-style credits on one of the user&apos;s workspaces.</CardDescription>
          </CardHeader>
          <CardContent>{workspaces.length === 0 ? <p className="text-sm text-muted-foreground">This user has no workspaces.</p> : <GrantCreditsForm user={panelUser} workspaces={workspaces} />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Complimentary plan</CardTitle>
            <CardDescription>Grants paid-plan entitlements without payment until the chosen date.</CardDescription>
          </CardHeader>
          <CardContent>{workspaces.length === 0 ? <p className="text-sm text-muted-foreground">This user has no workspaces.</p> : <ComplimentaryPlanForm userId={user.id} workspaces={workspaces} plans={plans} />}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit history</CardTitle>
          <CardDescription>Admin actions targeting this user, and actions this user performed as an admin.</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries.</p>
          ) : (
            <ul className="divide-y">
              {audit.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{a.action}</Badge>
                      <span className="text-sm text-muted-foreground">
                        by {a.actor?.name ?? a.actorEmail ?? "system"}
                        {a.targetId && a.targetId !== user.id ? ` · target ${a.targetType} ${a.targetId.slice(0, 8)}…` : ""}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                  </div>
                  {a.reason ? <p className="mt-1 text-sm">Reason: {a.reason}</p> : null}
                  {a.previousValue !== null || a.newValue !== null ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Details</summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <JsonBlock value={a.previousValue} maxHeight="10rem" />
                        <JsonBlock value={a.newValue} maxHeight="10rem" />
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Deleting an account removes the user, their sessions and any workspaces they solely own.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteUserPanel user={panelUser} />
        </CardContent>
      </Card>
    </div>
  );
}
