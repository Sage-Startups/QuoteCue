"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, FileText, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { STATUS_LABELS } from "@/lib/quotes/status";
import type { WizardData } from "./types";

export function StepConfirmation({ data, publicUrl }: { data: WizardData; publicUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const delivered = data.quote.sentAt !== null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-green-100 text-success">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-2xl font-bold">{delivered ? "Quote sent" : "Quote saved"}</h2>
        <p className="text-muted-foreground">{delivered ? "Your customer can view, download, accept or decline it from the secure link." : "Send it whenever you are ready from the quote page."}</p>
      </div>
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Item label="Quote number" value={data.quote.number} />
          <Item label="Customer" value={data.customer ? (data.customer.companyName ?? data.customer.contactName) : "Not set"} />
          <Item label="Total" value={formatMoney(data.quote.totalMinor, data.quote.currency)} />
          <Item label="Delivery state" value={<Badge variant={delivered ? "info" : "muted"}>{STATUS_LABELS[data.quote.status]}</Badge>} />
          <Item label="Follow-up date" value={data.quote.followUpAt ? formatDate(new Date(data.quote.followUpAt)) : "—"} />
          <Item label="Expires" value={formatDate(new Date(data.quote.expiresAt))} />
        </CardContent>
      </Card>
      {publicUrl ? (
        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold">Customer link</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={publicUrl} className="h-10 flex-1 rounded-lg border bg-muted px-3 font-mono text-xs" aria-label="Customer link" onFocus={(e) => e.target.select()} />
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicUrl);
                    setCopied(true);
                    toast.success("Link copied");
                  } catch {
                    toast.error("Could not copy; select the link and copy it manually.");
                  }
                }}
              >
                <Copy /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {data.emailPreviewMode && delivered ? (
        <Alert variant="warning">
          Email preview mode is on, so the customer email was not delivered.{" "}
          <Link href="/app/dev/emails" className="font-semibold underline">
            Open Email previews
          </Link>{" "}
          to see it.
        </Alert>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href={`/app/quotes/${data.quote.id}`}>
            <FileText /> View quote
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app/quotes/new">
            <PlusCircle /> Start another quote
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
