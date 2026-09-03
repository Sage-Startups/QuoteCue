"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, Alert } from "@/components/ui/misc";
import { createCustomerAction, updateCustomerAction, checkDuplicateCustomerAction } from "@/app/app/customers/actions";

export interface CustomerFormValues {
  id?: string;
  type: "INDIVIDUAL" | "COMPANY";
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  preferredContactMethod: "EMAIL" | "PHONE" | "SMS" | "WHATSAPP";
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingRegion: string;
  billingPostalCode: string;
  billingCountry: string;
  jobAddressSameAsBilling: boolean;
  jobAddressLine1: string;
  jobAddressLine2: string;
  jobCity: string;
  jobRegion: string;
  jobPostalCode: string;
  jobCountry: string;
  internalNotes: string;
  tags: string;
}

export function CustomerForm({ initial, existingTags, redirectOnSuccess }: { initial?: Partial<CustomerFormValues>; existingTags: string[]; redirectOnSuccess?: (id: string) => string }) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [state, action, pending] = useActionState(isEdit ? updateCustomerAction : createCustomerAction, null);
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">(initial?.type ?? "INDIVIDUAL");
  const [sameAddress, setSameAddress] = useState(initial?.jobAddressSameAsBilling ?? true);
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [duplicates, setDuplicates] = useState<Array<{ id: string; contactName: string; companyName: string | null; email: string | null; phone: string | null }>>([]);
  const err = (field: string) => (state && !state.ok ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state?.ok) {
      router.push(redirectOnSuccess ? redirectOnSuccess(state.data.id) : `/app/customers/${state.data.id}`);
      router.refresh();
    }
  }, [state, router, redirectOnSuccess]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!email && !phone) return setDuplicates([]);
      try {
        const result = await checkDuplicateCustomerAction({ email: email || undefined, phone: phone || undefined, excludeId: initial?.id });
        setDuplicates(result);
      } catch {
        setDuplicates([]);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [email, phone, initial?.id]);

  return (
    <form action={action} className="space-y-6" noValidate>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      {duplicates.length > 0 ? (
        <Alert variant="warning" title="Possible duplicate">
          A customer with a matching email or phone already exists:{" "}
          {duplicates.map((d) => (
            <a key={d.id} href={`/app/customers/${d.id}`} className="font-semibold underline">
              {d.companyName ?? d.contactName}
            </a>
          ))}
          . You can still save this customer if it is a different person.
        </Alert>
      ) : null}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Contact</h2>
        <Field label="Customer type" htmlFor="type" required>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as "INDIVIDUAL" | "COMPANY")}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="COMPANY">Company</option>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="contactName" required error={err("contactName")}>
            <Input id="contactName" name="contactName" defaultValue={initial?.contactName} autoComplete="name" required />
          </Field>
          <Field label="Company name" htmlFor="companyName" required={type === "COMPANY"} error={err("companyName")}>
            <Input id="companyName" name="companyName" defaultValue={initial?.companyName} autoComplete="organization" />
          </Field>
          <Field label="Email" htmlFor="email" error={err("email")}>
            <Input id="email" name="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Telephone" htmlFor="phone" error={err("phone")}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </Field>
        </div>
        <Field label="Preferred contact method" htmlFor="preferredContactMethod">
          <Select id="preferredContactMethod" name="preferredContactMethod" defaultValue={initial?.preferredContactMethod ?? "EMAIL"}>
            <option value="EMAIL">Email</option>
            <option value="PHONE">Phone call</option>
            <option value="SMS">Text message</option>
            <option value="WHATSAPP">WhatsApp</option>
          </Select>
        </Field>
      </section>
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Billing address</h2>
        <Field label="Address line 1" htmlFor="billingAddressLine1" error={err("billingAddressLine1")}>
          <Input id="billingAddressLine1" name="billingAddressLine1" defaultValue={initial?.billingAddressLine1} />
        </Field>
        <Field label="Address line 2" htmlFor="billingAddressLine2">
          <Input id="billingAddressLine2" name="billingAddressLine2" defaultValue={initial?.billingAddressLine2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Town or city" htmlFor="billingCity">
            <Input id="billingCity" name="billingCity" defaultValue={initial?.billingCity} />
          </Field>
          <Field label="Region" htmlFor="billingRegion">
            <Input id="billingRegion" name="billingRegion" defaultValue={initial?.billingRegion} />
          </Field>
          <Field label="Postcode" htmlFor="billingPostalCode">
            <Input id="billingPostalCode" name="billingPostalCode" defaultValue={initial?.billingPostalCode} />
          </Field>
          <Field label="Country code" htmlFor="billingCountry" hint="Two letters, e.g. GB.">
            <Input id="billingCountry" name="billingCountry" defaultValue={initial?.billingCountry ?? "GB"} maxLength={2} />
          </Field>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Job address</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="jobAddressSameAsBilling" checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} className="size-4 accent-primary" />
          Same as billing address
        </label>
        {!sameAddress ? (
          <div className="space-y-4">
            <Field label="Address line 1" htmlFor="jobAddressLine1">
              <Input id="jobAddressLine1" name="jobAddressLine1" defaultValue={initial?.jobAddressLine1} />
            </Field>
            <Field label="Address line 2" htmlFor="jobAddressLine2">
              <Input id="jobAddressLine2" name="jobAddressLine2" defaultValue={initial?.jobAddressLine2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Town or city" htmlFor="jobCity">
                <Input id="jobCity" name="jobCity" defaultValue={initial?.jobCity} />
              </Field>
              <Field label="Region" htmlFor="jobRegion">
                <Input id="jobRegion" name="jobRegion" defaultValue={initial?.jobRegion} />
              </Field>
              <Field label="Postcode" htmlFor="jobPostalCode">
                <Input id="jobPostalCode" name="jobPostalCode" defaultValue={initial?.jobPostalCode} />
              </Field>
              <Field label="Country code" htmlFor="jobCountry">
                <Input id="jobCountry" name="jobCountry" defaultValue={initial?.jobCountry ?? "GB"} maxLength={2} />
              </Field>
            </div>
          </div>
        ) : null}
      </section>
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Internal</h2>
        <Field label="Tags" htmlFor="tags" hint={existingTags.length > 0 ? `Comma separated. Existing: ${existingTags.slice(0, 8).join(", ")}` : "Comma separated, e.g. Landlord, Repeat customer"}>
          <Input id="tags" name="tags" defaultValue={initial?.tags} list="tag-suggestions" />
          <datalist id="tag-suggestions">
            {existingTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Internal notes" htmlFor="internalNotes" hint="Never shown to the customer.">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes} rows={4} />
        </Field>
      </section>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {isEdit ? "Save changes" : "Create customer"}
        </Button>
      </div>
    </form>
  );
}
