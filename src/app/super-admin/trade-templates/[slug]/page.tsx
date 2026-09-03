import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TradeTemplateForm } from "../template-form";
import { templateToFormValues } from "../values";

export const metadata: Metadata = { title: "Trade template" };

export default async function TradeTemplateEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireSuperAdminForPage(`/super-admin/trade-templates/${slug}`);
  if (!/^[a-z0-9-]+$/.test(slug)) notFound();
  const template = await prisma.tradeTemplate.findUnique({ where: { slug } });
  if (!template) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/trade-templates" className="hover:underline">
            Trade templates
          </Link>
        }
        title={template.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{template.slug}</span>
            <Badge variant={template.isActive ? "success" : "muted"}>{template.isActive ? "Active" : "Inactive"}</Badge>
            <span>Updated {formatDateTime(template.updatedAt)}</span>
          </span>
        }
      />
      <Card>
        <CardContent className="pt-5 md:pt-6">
          <TradeTemplateForm values={templateToFormValues(template)} mode="edit" />
        </CardContent>
      </Card>
    </div>
  );
}
