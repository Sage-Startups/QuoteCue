import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getCustomer, listCustomerTags } from "@/lib/services/customers";
import { PageHeader } from "@/components/ui/misc";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspaceForPage(`/app/customers/${id}/edit`);
  if (ctx.supportSession) redirect(`/app/customers/${id}`);
  const [customer, tags] = await Promise.all([getCustomer(ctx.workspace.id, id).catch(() => null), listCustomerTags(ctx.workspace.id)]);
  if (!customer) notFound();
  const sameAddress = [customer.billingAddressLine1, customer.billingCity, customer.billingPostalCode].join("|") === [customer.jobAddressLine1, customer.jobCity, customer.jobPostalCode].join("|");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Edit customer" />
      <div className="rounded-xl border bg-card p-5 shadow-card md:p-6">
        <CustomerForm
          existingTags={tags.map((t) => t.name)}
          initial={{
            id: customer.id,
            type: customer.type,
            contactName: customer.contactName,
            companyName: customer.companyName ?? "",
            email: customer.email ?? "",
            phone: customer.phone ?? "",
            preferredContactMethod: customer.preferredContactMethod,
            billingAddressLine1: customer.billingAddressLine1 ?? "",
            billingAddressLine2: customer.billingAddressLine2 ?? "",
            billingCity: customer.billingCity ?? "",
            billingRegion: customer.billingRegion ?? "",
            billingPostalCode: customer.billingPostalCode ?? "",
            billingCountry: customer.billingCountry ?? "",
            jobAddressSameAsBilling: sameAddress,
            jobAddressLine1: customer.jobAddressLine1 ?? "",
            jobAddressLine2: customer.jobAddressLine2 ?? "",
            jobCity: customer.jobCity ?? "",
            jobRegion: customer.jobRegion ?? "",
            jobPostalCode: customer.jobPostalCode ?? "",
            jobCountry: customer.jobCountry ?? "",
            internalNotes: customer.internalNotes ?? "",
            tags: customer.tags.map((t) => t.tag.name).join(", "),
          }}
        />
      </div>
    </div>
  );
}
