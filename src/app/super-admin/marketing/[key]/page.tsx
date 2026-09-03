import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMarketingContent, MARKETING_KEY_LABELS, marketingSchemas, type MarketingKey } from "@/lib/config/marketing-content";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { enumParam } from "../../_lib/admin";
import { MarketingSectionEditor } from "./editor";
import type { JsonValue } from "@/components/admin/structured-editor";

export const metadata: Metadata = { title: "Marketing section" };

export default async function MarketingSectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  await requireSuperAdminForPage(`/super-admin/marketing/${raw}`);
  const key = enumParam(raw, Object.keys(marketingSchemas) as MarketingKey[]);
  if (!key) notFound();
  const [content, row] = await Promise.all([getMarketingContent(), prisma.marketingContent.findUnique({ where: { key } })]);
  const value = JSON.parse(JSON.stringify(content[key])) as JsonValue;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/marketing" className="hover:underline">
            Marketing content
          </Link>
        }
        title={MARKETING_KEY_LABELS[key]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{key}</span>
            <Badge variant={row ? "info" : "muted"}>{row ? `Customised ${formatDateTime(row.updatedAt)}` : "Default content"}</Badge>
          </span>
        }
      />
      {key === "testimonials" ? (
        <Alert variant="warning" title="Never publish fake testimonials">
          Only add quotes from real customers who have given permission to be named. New testimonials are unpublished until you tick &ldquo;Published&rdquo;.
        </Alert>
      ) : null}
      <Card>
        <CardContent className="pt-5 md:pt-6">
          <MarketingSectionEditor sectionKey={key} initial={value} customised={!!row} />
        </CardContent>
      </Card>
    </div>
  );
}
