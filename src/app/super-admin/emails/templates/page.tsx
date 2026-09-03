import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_KINDS } from "@/lib/email/templates";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Email templates" };

export default async function EmailTemplatesPage() {
  await requireSuperAdminForPage("/super-admin/emails/templates");
  const rows = await prisma.emailTemplate.findMany();
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/emails" className="hover:underline">
            Email activity
          </Link>
        }
        title="Email templates"
        description="Subject lines and Markdown bodies for every transactional email. Templates that have not been customised use the built-in default."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {EMAIL_KINDS.map((kind) => {
            const def = DEFAULT_EMAIL_TEMPLATES[kind];
            const row = byKind.get(kind);
            return (
              <TableRow key={kind}>
                <TableCell>
                  <Link href={`/super-admin/emails/templates/${kind}`} className="font-semibold hover:underline">
                    {row?.name ?? def.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{def.description}</span>
                </TableCell>
                <TableCell className="text-sm">{row?.subject ?? def.subject}</TableCell>
                <TableCell>
                  <Badge variant={row ? "info" : "muted"}>{row ? "Customised" : "Default"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row?.enabled === false ? "destructive" : "success"}>{row?.enabled === false ? "Disabled" : "Enabled"}</Badge>
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
