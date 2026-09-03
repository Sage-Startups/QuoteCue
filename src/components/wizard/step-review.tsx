"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileDown, Link2, Mail, Pencil, Save, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { QuotePreview } from "@/components/quotes/quote-preview";
import type { QuoteDocumentData } from "@/lib/services/quote-document";
import { markReadyAction, copyLinkAction } from "@/app/app/quotes/actions";
import { SendQuoteDialog } from "./send-dialog";
import type { WizardData } from "./types";

export function StepReview({ data, document, isAdmin }: { data: WizardData; document: QuoteDocumentData; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  const unpriced = data.items.filter((i) => i.unitPriceMinor === 0 && !i.isOptional).length;
  const missingCustomer = !data.customer;
  const canSend = !missingCustomer && data.items.length > 0 && unpriced === 0;

  const saveDraft = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", data.quote.id);
      const result = await markReadyAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved as ready to send");
      router.push(`/app/quotes/${data.quote.id}`);
      router.refresh();
    });

  const copyLink = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", data.quote.id);
      const result = await copyLinkAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.data.url);
        toast.success("Customer link copied to clipboard");
      } catch {
        toast.success(`Customer link: ${result.data.url}`);
      }
      router.push(`/app/quotes/${data.quote.id}/edit?step=7`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {missingCustomer ? (
        <Alert variant="warning">
          No customer selected.{" "}
          <Link href={`/app/quotes/${data.quote.id}/edit?step=1`} className="font-semibold underline">
            Choose a customer
          </Link>{" "}
          before sending.
        </Alert>
      ) : null}
      {unpriced > 0 ? (
        <Alert variant="warning">
          {unpriced} line item{unpriced === 1 ? " is" : "s are"} unpriced.{" "}
          <Link href={`/app/quotes/${data.quote.id}/edit?step=4`} className="font-semibold underline">
            Set prices
          </Link>{" "}
          before sending.
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild>
          <Link href={`/app/quotes/${data.quote.id}/edit?step=5`}>
            <Pencil /> Edit wording
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={`/app/quotes/${data.quote.id}/edit?step=4`}>
            <Pencil /> Edit pricing
          </Link>
        </Button>
        {isAdmin ? (
          <Button variant="secondary" asChild>
            <Link href="/app/settings">
              <Palette /> Change branding
            </Link>
          </Button>
        ) : null}
      </div>
      <QuotePreview data={document} />
      <div className="sticky bottom-20 z-20 rounded-xl border bg-white/95 p-3 shadow-elevated backdrop-blur lg:bottom-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={saveDraft} loading={pending} disabled={!data.customer || data.items.length === 0}>
            <Save /> Save as ready
          </Button>
          {data.entitlements.canPdf ? (
            <Button variant="secondary" asChild>
              <a href={`/app/quotes/${data.quote.id}/pdf?download=1&fresh=1`}>
                <FileDown /> Download PDF
              </a>
            </Button>
          ) : null}
          {data.entitlements.canAcceptanceLinks ? (
            <Button variant="secondary" onClick={copyLink} loading={pending} disabled={!canSend}>
              <Link2 /> Copy customer link
            </Button>
          ) : null}
          <Button variant="accent" size="lg" className="ml-auto" onClick={() => setSendOpen(true)} disabled={!canSend || !data.flags.email || !data.entitlements.canSendEmail}>
            <Mail /> Send by email
          </Button>
        </div>
        {!data.flags.email ? <p className="mt-2 text-xs text-muted-foreground">Email sending is currently disabled by the administrator; share the customer link instead.</p> : null}
      </div>
      <SendQuoteDialog open={sendOpen} onOpenChange={setSendOpen} quoteId={data.quote.id} defaultEmail={data.customer?.email ?? ""} defaultMessage={data.wording.followUpEmail} emailPreviewMode={data.emailPreviewMode} onSent={() => router.push(`/app/quotes/${data.quote.id}/edit?step=7`)} />
    </div>
  );
}
