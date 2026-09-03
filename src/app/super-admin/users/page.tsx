import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatRelative } from "@/lib/utils/dates";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { CsvExportLink } from "@/components/admin/misc";
import { DemoBadge, PlatformRoleBadge } from "@/components/admin/badges";
import { PAGE_SIZE, pageCount, parsePage } from "../_lib/admin";
import { buildUserWhere } from "./query";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; verified?: string; suspended?: string; page?: string }> }) {
  const params = await searchParams;
  await requireSuperAdminForPage("/super-admin/users");
  const where = buildUserWhere(params);
  const page = parsePage(params.page);
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, emailVerified: true, platformRole: true, suspendedAt: true, lastLoginAt: true, createdAt: true, onboardingCompletedAt: true, memberships: { select: { workspace: { select: { id: true, name: true, isDemo: true } } }, take: 3 } },
    }),
  ]);
  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== "page") exportParams.set(k, v);
  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={`${total} user${total === 1 ? "" : "s"}`} actions={<CsvExportLink href={`/super-admin/users/export?${exportParams.toString()}`} />} />
      <SearchForm
        placeholder="Search name or email"
        query={params.q}
        filters={[
          { name: "role", label: "Role", value: params.role, options: [{ value: "", label: "All roles" }, { value: "USER", label: "User" }, { value: "SUPPORT_ADMIN", label: "Support admin" }, { value: "SUPER_ADMIN", label: "Super admin" }] },
          { name: "verified", label: "Verified", value: params.verified, options: [{ value: "", label: "Any" }, { value: "1", label: "Verified" }, { value: "0", label: "Unverified" }] },
          { name: "suspended", label: "Suspended", value: params.suspended, options: [{ value: "", label: "Any" }, { value: "1", label: "Suspended" }, { value: "0", label: "Not suspended" }] },
        ]}
      />
      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users match" description="Try a different search or filter." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {users.map((u) => (
              <Link key={u.id} href={`/super-admin/users/${u.id}`} className="block rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <PlatformRoleBadge role={u.platformRole} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant={u.emailVerified ? "success" : "warning"}>{u.emailVerified ? "Verified" : "Unverified"}</Badge>
                  {u.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : null}
                  {u.memberships.some((m) => m.workspace.isDemo) ? <DemoBadge /> : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Joined {formatDate(u.createdAt)} · last login {u.lastLoginAt ? formatRelative(u.lastLoginAt) : "never"}
                </p>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Workspaces</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Link href={`/super-admin/users/${u.id}`} className="block font-semibold hover:underline">
                        {u.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </TableCell>
                    <TableCell>
                      <PlatformRoleBadge role={u.platformRole} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={u.emailVerified ? "success" : "warning"}>{u.emailVerified ? "Verified" : "Unverified"}</Badge>
                        {u.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : null}
                        {!u.onboardingCompletedAt ? <Badge variant="muted">Onboarding</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-wrap items-center gap-1">
                        {u.memberships.length === 0 ? <span className="text-muted-foreground">—</span> : null}
                        {u.memberships.map((m) => (
                          <span key={m.workspace.id} className="inline-flex items-center gap-1">
                            <Link href={`/super-admin/workspaces/${m.workspace.id}`} className="hover:underline">
                              {m.workspace.name}
                            </Link>
                            {m.workspace.isDemo ? <DemoBadge /> : null}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "never"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pages={pageCount(total)} total={total} basePath="/super-admin/users" params={{ q: params.q, role: params.role, verified: params.verified, suspended: params.suspended }} />
        </>
      )}
    </div>
  );
}
