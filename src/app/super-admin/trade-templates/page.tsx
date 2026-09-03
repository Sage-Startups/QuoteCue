import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Trade templates" };

export default async function TradeTemplatesPage() {
  await requireSuperAdminForPage("/super-admin/trade-templates");
  const templates = await prisma.tradeTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Trade templates"
        description="Starter catalogues and wording offered during onboarding and shown on the public templates page."
        actions={
          <Button asChild>
            <Link href="/super-admin/trade-templates/new">
              <Plus /> New template
            </Link>
          </Button>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="text-right">Services</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Order</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Link href={`/super-admin/trade-templates/${t.slug}`} className="font-semibold hover:underline">
                  {t.name}
                </Link>
                {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
              </TableCell>
              <TableCell className="font-mono text-xs">{t.slug}</TableCell>
              <TableCell className="text-right tabular">{Array.isArray(t.suggestedServices) ? t.suggestedServices.length : 0}</TableCell>
              <TableCell>
                <Badge variant={t.isActive ? "success" : "muted"}>{t.isActive ? "Active" : "Inactive"}</Badge>
              </TableCell>
              <TableCell className="text-right tabular">{t.sortOrder}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDateTime(t.updatedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
