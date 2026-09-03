import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MARKETING_KEY_LABELS, marketingSchemas, type MarketingKey } from "@/lib/config/marketing-content";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Marketing content" };

export default async function MarketingContentPage() {
  await requireSuperAdminForPage("/super-admin/marketing");
  const rows = await prisma.marketingContent.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const keys = Object.keys(marketingSchemas) as MarketingKey[];
  return (
    <div className="space-y-6">
      <PageHeader title="Marketing content" description="Copy for the public website. Each section is validated against a schema and published immediately when saved." />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => {
            const row = byKey.get(key);
            return (
              <TableRow key={key}>
                <TableCell>
                  <Link href={`/super-admin/marketing/${key}`} className="font-semibold hover:underline">
                    {MARKETING_KEY_LABELS[key]}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{key}</TableCell>
                <TableCell>
                  <Badge variant={row ? "info" : "muted"}>{row ? "Customised" : "Default"}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row ? formatDateTime(row.updatedAt) : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
