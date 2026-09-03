import type { Metadata } from "next";
import { requireWorkspaceForPage } from "@/lib/auth";
import { listCustomerTags } from "@/lib/services/customers";
import { PageHeader } from "@/components/ui/misc";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  const ctx = await requireWorkspaceForPage("/app/customers/new");
  const tags = await listCustomerTags(ctx.workspace.id);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Add customer" />
      <div className="rounded-xl border bg-card p-5 shadow-card md:p-6">
        <CustomerForm existingTags={tags.map((t) => t.name)} />
      </div>
    </div>
  );
}
