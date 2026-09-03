import type { Metadata } from "next";
import Link from "next/link";
import { HardDrive, Files, Trash2, Server } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { PageHeader, StatCard, Progress } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSeriesChart } from "@/components/admin/admin-charts";
import { DemoBadge } from "@/components/admin/badges";
import { formatBytes, formatNumber, timeAgo } from "@/components/admin/format";

export const metadata: Metadata = { title: "Storage" };

export default async function StoragePage() {
  await requireSuperAdminForPage("/super-admin/storage");
  const env = getEnv();
  const since = timeAgo(90 * 86_400_000);
  const [live, deleted, byPurpose, byWorkspace, snapshots, pendingUploads] = await Promise.all([
    prisma.storedObject.aggregate({ where: { deletedAt: null }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.storedObject.aggregate({ where: { deletedAt: { not: null } }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.storedObject.groupBy({ by: ["purpose"], where: { deletedAt: null }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.storedObject.groupBy({ by: ["workspaceId"], where: { deletedAt: null, workspaceId: { not: null } }, _sum: { sizeBytes: true }, _count: { _all: true }, orderBy: { _sum: { sizeBytes: "desc" } }, take: 15 }),
    prisma.storageUsageSnapshot.findMany({ where: { workspaceId: null, recordedAt: { gte: since } }, orderBy: { recordedAt: "asc" } }),
    prisma.upload.count({ where: { status: "PENDING" } }),
  ]);
  const wsIds = byWorkspace.map((w) => w.workspaceId).filter((id): id is string => !!id);
  const workspaces = wsIds.length > 0 ? await prisma.workspace.findMany({ where: { id: { in: wsIds } }, select: { id: true, name: true, isDemo: true, subscription: { select: { plan: { select: { name: true, storageAllowanceMb: true } } } } } }) : [];
  const totalBytes = live._sum.sizeBytes ?? 0;
  const byDay = new Map<string, { bytes: number; objects: number }>();
  for (const s of snapshots) byDay.set(s.recordedAt.toISOString().slice(0, 10), { bytes: Number(s.totalBytes), objects: s.objectCount });
  const series = [...byDay.entries()].map(([day, v]) => ({ day, bytes: v.bytes, objects: v.objects }));

  return (
    <div className="space-y-6">
      <PageHeader title="Storage" description="Object storage usage across all workspaces." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Storage used" value={formatBytes(totalBytes)} hint="Live objects" icon={HardDrive} />
        <StatCard label="Objects" value={formatNumber(live._count._all)} hint={`${pendingUploads} pending upload${pendingUploads === 1 ? "" : "s"}`} icon={Files} />
        <StatCard label="Soft-deleted" value={formatBytes(deleted._sum.sizeBytes ?? 0)} hint={`${formatNumber(deleted._count._all)} objects awaiting cleanup`} icon={Trash2} />
        <StatCard label="Provider" value={env.providers.storage} hint={env.providers.storage === "local" || env.providers.storage === "memory" ? "Not suitable for production" : "Bucket storage"} icon={Server} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By purpose</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Objects</TableHead>
                  <TableHead className="text-right">Bytes</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPurpose
                  .sort((a, b) => (b._sum.sizeBytes ?? 0) - (a._sum.sizeBytes ?? 0))
                  .map((p) => (
                    <TableRow key={p.purpose}>
                      <TableCell>
                        <Badge variant="outline">{p.purpose.toLowerCase().replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular">{formatNumber(p._count._all)}</TableCell>
                      <TableCell className="text-right tabular">{formatBytes(p._sum.sizeBytes ?? 0)}</TableCell>
                      <TableCell className="text-right tabular">{totalBytes > 0 ? `${(((p._sum.sizeBytes ?? 0) / totalBytes) * 100).toFixed(1)}%` : "0%"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Platform usage over time</CardTitle>
            <CardDescription>Daily snapshots recorded by the storage cron job (last 90 days).</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminSeriesChart type="line" data={series} label="Storage bytes per day" series={[{ key: "bytes", name: "Bytes", color: "#2b4a86" }]} formatter={(v) => formatBytes(v)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top workspaces by storage</CardTitle>
          <CardDescription>Fifteen largest workspaces compared with their plan allowance.</CardDescription>
        </CardHeader>
        <CardContent>
          {byWorkspace.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspace files stored yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Objects</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="w-48">Allowance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byWorkspace.map((row) => {
                  const w = workspaces.find((x) => x.id === row.workspaceId);
                  const allowanceBytes = (w?.subscription?.plan.storageAllowanceMb ?? 0) * 1024 * 1024;
                  const used = row._sum.sizeBytes ?? 0;
                  return (
                    <TableRow key={row.workspaceId}>
                      <TableCell>
                        <Link href={`/super-admin/workspaces/${row.workspaceId}`} className="font-semibold hover:underline">
                          {w?.name ?? "Unknown"}
                        </Link>{" "}
                        {w?.isDemo ? <DemoBadge /> : null}
                      </TableCell>
                      <TableCell className="text-sm">{w?.subscription?.plan.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular">{formatNumber(row._count._all)}</TableCell>
                      <TableCell className="text-right tabular">{formatBytes(used)}</TableCell>
                      <TableCell>
                        <Progress value={used} max={allowanceBytes || 1} label={`Storage used by ${w?.name ?? "workspace"}`} />
                        <span className="text-xs text-muted-foreground">
                          {allowanceBytes > 0 ? `${Math.round((used / allowanceBytes) * 100)}% of ${w?.subscription?.plan.storageAllowanceMb} MB` : "No allowance set"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
