"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import type { QuoteDocumentData } from "@/lib/services/quote-document";
import { WizardNav } from "./wizard-nav";
import { StepCustomer } from "./step-customer";
import { StepEnquiry } from "./step-enquiry";
import { StepAnalysis } from "./step-analysis";
import { StepPricing } from "./step-pricing";
import { StepWording } from "./step-wording";
import { StepReview } from "./step-review";
import { StepConfirmation } from "./step-confirmation";
import { WIZARD_STEPS, type WizardData } from "./types";

export function QuoteWizard({ data, step, catalogue, document, publicUrl, isAdmin }: { data: WizardData; step: number; catalogue: Array<{ id: string; name: string; category: string }>; document: QuoteDocumentData | null; publicUrl: string | null; isAdmin: boolean }) {
  const meta = WIZARD_STEPS.find((s) => s.step === step) ?? WIZARD_STEPS[0];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to quote">
            <Link href={`/app/quotes/${data.quote.id}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {data.quote.number} · Step {step} of {WIZARD_STEPS.length}
            </p>
            <h1 className="text-xl font-bold md:text-2xl">{meta.title}</h1>
          </div>
        </div>
        <QuoteStatusBadge status={data.quote.status} />
      </div>
      <WizardNav quoteId={data.quote.id} current={step} maxReached={data.quote.wizardStep} />
      {step === 1 ? <StepCustomer data={data} /> : null}
      {step === 2 ? <StepEnquiry data={data} /> : null}
      {step === 3 ? <StepAnalysis data={data} catalogue={catalogue} /> : null}
      {step === 4 ? <StepPricing data={data} /> : null}
      {step === 5 ? <StepWording data={data} /> : null}
      {step === 6 && document ? <StepReview data={data} document={document} isAdmin={isAdmin} /> : null}
      {step === 7 ? <StepConfirmation data={data} publicUrl={publicUrl} /> : null}
    </div>
  );
}
