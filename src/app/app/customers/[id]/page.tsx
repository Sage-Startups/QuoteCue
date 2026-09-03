import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Pencil, PlusCircle, RotateCcw } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getCustomer, customerDisplayName, formatAddress } from "@/lib/services/customers";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/app/confirm-button";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { archiveCustomerAction } from "../actions";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspaceForPage(`/app/customers/${id}`);
  const customer = await getCustomer(ctx.workspace.id, id).catch(() => null);
  if (!customer) notFound();
  const readOnly = !!ctx.supportSession;
  const accepted = customer.quotes.filter((q) => q.status === "ACCEPTED");
  const total = accepted.reduce((a, q) => a + q.totalMinor, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={customer.type === "COMPANY" ? "Company" : "Individual"}
        title={customerDisplayName(customer)}
        description={customer.archivedAt ? "Archived customer" : `${customer.quotes.length} quotes · ${accepted.length} accepted`}
        actions={
          readOnly ? null : (
            <>
              <Button asChild variant="accent">
                <Link href={`/app/quotes/new?customerId=${customer.id}`}>
                  <PlusCircle /> New quote
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/app/customers/${customer.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
              <ConfirmButton
                action={archiveCustomerAction}
                hidden={{ id: customer.id, archived: customer.archivedAt ? "false" : "true" }}
                variant="ghost"
                confirmTitle={customer.archivedAt ? "Restore customer?" : "Archive customer?"}
                confirmDescription={customer.archivedAt ? "The customer will appear in your active list again." : "Archived customers are hidden from lists but their quotes are kept."}
                confirmLabel={customer.archivedAt ? "Restore" : "Archive"}
              >
                {customer.archivedAt ? <RotateCcw /> : <Archive />}
                {customer.archivedAt ? "Restore" : "Archive"}
              </ConfirmButton>
            </>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span> {customer.email ? <a href={`mailto:${customer.email}`} className="underline">{customer.email}</a> : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span> {customer.phone ? <a href={`tel:${customer.phone}`} className="underline">{customer.phone}</a> : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Prefers:</span> {customer.preferredContactMethod.toLowerCase()}
            </p>
            <p>
              <span className="text-muted-foreground">Billing:</span> {formatAddress([customer.billingAddressLine1, customer.billingAddressLine2, customer.billingCity, customer.billingRegion, customer.billingPostalCode]) || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Job address:</span> {formatAddress([customer.jobAddressLine1, customer.jobAddressLine2, customer.jobCity, customer.jobRegion, customer.jobPostalCode]) || "—"}
            </p>
            {customer.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {customer.tags.map((t) => (
                  <Badge key={t.tagId} variant="outline">
                    {t.tag.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Internal notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{customer.internalNotes ?? <span className="text-muted-foreground">No notes yet.</span>}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Customer since</span> <span>{formatDate(customer.createdAt)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Quotes</span> <span>{customer.quotes.length}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Accepted value</span> <span className="font-semibold">{customer.quotes[0] ? formatMoney(total, customer.quotes[0].currency) : "—"}</span>
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quote history</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotes yet for this customer.</p>
          ) : (
            <ul className="divide-y">
              {customer.quotes.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/app/quotes/${q.id}`} className="block truncate font-semibold hover:underline">
                      {q.number} · {q.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(q.createdAt)}
                      {q.sentAt ? ` · sent ${formatDate(q.sentAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular">{formatMoney(q.totalMinor, q.currency)}</span>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
