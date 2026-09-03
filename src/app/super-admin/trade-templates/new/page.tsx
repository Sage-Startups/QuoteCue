import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdminForPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { TradeTemplateForm } from "../template-form";
import { EMPTY_TEMPLATE } from "../values";

export const metadata: Metadata = { title: "New trade template" };

export default async function NewTradeTemplatePage() {
  await requireSuperAdminForPage("/super-admin/trade-templates/new");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/trade-templates" className="hover:underline">
            Trade templates
          </Link>
        }
        title="New trade template"
        description="Prices are examples only and are always editable by the workspace."
      />
      <Card>
        <CardContent className="pt-5 md:pt-6">
          <TradeTemplateForm values={EMPTY_TEMPLATE} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
