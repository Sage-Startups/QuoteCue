"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Alert } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { searchCustomersAction, quickCreateCustomerAction } from "@/app/app/customers/actions";
import { saveBasicsAction } from "@/app/app/quotes/[id]/edit/actions";
import type { WizardCustomer, WizardData } from "./types";

export function StepCustomer({ data }: { data: WizardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [customer, setCustomer] = useState<WizardCustomer | null>(data.customer);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WizardCustomer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState({ contactName: "", companyName: "", email: "", phone: "", jobAddressLine1: "", jobCity: "", jobPostalCode: "" });
  const [form, setForm] = useState({
    title: data.quote.title === "New quote" ? "" : data.quote.title,
    reference: data.quote.reference,
    expiresAt: data.quote.expiresAt,
    jobAddressLine1: data.quote.jobAddressLine1,
    jobAddressLine2: data.quote.jobAddressLine2,
    jobCity: data.quote.jobCity,
    jobRegion: data.quote.jobRegion,
    jobPostalCode: data.quote.jobPostalCode,
    jobCountry: data.quote.jobCountry || data.settings.country,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (customer) return;
    const handle = setTimeout(async () => {
      try {
        setResults(await searchCustomersAction(query));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, customer]);

  const pick = (c: WizardCustomer) => {
    setCustomer(c);
    setForm((f) => ({ ...f, jobAddressLine1: f.jobAddressLine1 || c.jobAddressLine1 || "", jobCity: f.jobCity || c.jobCity || "", jobPostalCode: f.jobPostalCode || c.jobPostalCode || "" }));
  };

  const createCustomer = () =>
    start(async () => {
      const result = await quickCreateCustomerAction(creating);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      pick({ id: result.data.id, contactName: creating.contactName, companyName: creating.companyName || null, email: creating.email || null, phone: creating.phone || null, jobAddressLine1: creating.jobAddressLine1 || null, jobCity: creating.jobCity || null, jobPostalCode: creating.jobPostalCode || null });
      setShowCreate(false);
      toast.success("Customer created");
    });

  const save = () =>
    start(async () => {
      setErrors({});
      const result = await saveBasicsAction(data.quote.id, { ...form, customerId: customer?.id ?? "" });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        {
        toast.error(result.error);
        return;
      }
      }
      router.push(`/app/quotes/${data.quote.id}/edit?step=2`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
          <CardDescription>Choose an existing customer or create one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customer ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-4">
              <div>
                <p className="font-semibold">{customer.companyName ? `${customer.companyName} (${customer.contactName})` : customer.contactName}</p>
                <p className="text-sm text-muted-foreground">{[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                <X /> Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <label htmlFor="customer-search" className="sr-only">
                  Search customers
                </label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="customer-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, company or email" className="pl-9" autoComplete="off" />
              </div>
              {results.length > 0 ? (
                <ul className="divide-y rounded-lg border" role="listbox" aria-label="Matching customers">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => pick(c)} className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                        <span className="font-medium">{c.companyName ? `${c.companyName} (${c.contactName})` : c.contactName}</span>
                        <span className="text-xs text-muted-foreground">{[c.email, c.phone, c.jobCity].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query ? (
                <p className="text-sm text-muted-foreground">No customers match &ldquo;{query}&rdquo;.</p>
              ) : null}
              {!showCreate ? (
                <Button variant="secondary" onClick={() => setShowCreate(true)}>
                  <UserPlus /> Create a new customer
                </Button>
              ) : (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Contact name" htmlFor="qc-name" required>
                      <Input id="qc-name" value={creating.contactName} onChange={(e) => setCreating({ ...creating, contactName: e.target.value })} autoComplete="name" />
                    </Field>
                    <Field label="Company (optional)" htmlFor="qc-company">
                      <Input id="qc-company" value={creating.companyName} onChange={(e) => setCreating({ ...creating, companyName: e.target.value })} />
                    </Field>
                    <Field label="Email" htmlFor="qc-email">
                      <Input id="qc-email" type="email" inputMode="email" value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} />
                    </Field>
                    <Field label="Phone" htmlFor="qc-phone">
                      <Input id="qc-phone" type="tel" inputMode="tel" value={creating.phone} onChange={(e) => setCreating({ ...creating, phone: e.target.value })} />
                    </Field>
                    <Field label="Job address" htmlFor="qc-addr">
                      <Input id="qc-addr" value={creating.jobAddressLine1} onChange={(e) => setCreating({ ...creating, jobAddressLine1: e.target.value })} />
                    </Field>
                    <Field label="Town" htmlFor="qc-city">
                      <Input id="qc-city" value={creating.jobCity} onChange={(e) => setCreating({ ...creating, jobCity: e.target.value })} />
                    </Field>
                    <Field label="Postcode" htmlFor="qc-post">
                      <Input id="qc-post" value={creating.jobPostalCode} onChange={(e) => setCreating({ ...creating, jobPostalCode: e.target.value })} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={createCustomer} loading={pending} disabled={creating.contactName.trim().length < 1}>
                      Save customer
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>Confirm the job address, reference and expiry date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quote title" htmlFor="title" error={errors.title} hint="You can let AI suggest one later.">
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Kitchen rewire" />
            </Field>
            <Field label="Your reference" htmlFor="reference" error={errors.reference} hint="Optional, e.g. a job or PO number.">
              <Input id="reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </Field>
            <Field label="Quote number" htmlFor="number-ro">
              <Input id="number-ro" value={data.quote.number} readOnly disabled />
            </Field>
            <Field label="Expiry date" htmlFor="expiresAt" required error={errors.expiresAt}>
              <Input id="expiresAt" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job address line 1" htmlFor="jobAddressLine1" error={errors.jobAddressLine1}>
              <Input id="jobAddressLine1" value={form.jobAddressLine1} onChange={(e) => setForm({ ...form, jobAddressLine1: e.target.value })} autoComplete="address-line1" />
            </Field>
            <Field label="Line 2" htmlFor="jobAddressLine2">
              <Input id="jobAddressLine2" value={form.jobAddressLine2} onChange={(e) => setForm({ ...form, jobAddressLine2: e.target.value })} autoComplete="address-line2" />
            </Field>
            <Field label="Town or city" htmlFor="jobCity">
              <Input id="jobCity" value={form.jobCity} onChange={(e) => setForm({ ...form, jobCity: e.target.value })} />
            </Field>
            <Field label="Region" htmlFor="jobRegion">
              <Input id="jobRegion" value={form.jobRegion} onChange={(e) => setForm({ ...form, jobRegion: e.target.value })} />
            </Field>
            <Field label="Postcode" htmlFor="jobPostalCode">
              <Input id="jobPostalCode" value={form.jobPostalCode} onChange={(e) => setForm({ ...form, jobPostalCode: e.target.value })} />
            </Field>
            <Field label="Country code" htmlFor="jobCountry" error={errors.jobCountry}>
              <Input id="jobCountry" value={form.jobCountry} onChange={(e) => setForm({ ...form, jobCountry: e.target.value.toUpperCase() })} maxLength={2} />
            </Field>
          </div>
        </CardContent>
      </Card>
      {!customer ? <Alert variant="info">You can continue without a customer and add one before sending.</Alert> : null}
      <div className="flex justify-end">
        <Button size="lg" onClick={save} loading={pending}>
          Save and continue
        </Button>
      </div>
    </div>
  );
}
