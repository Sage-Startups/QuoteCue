"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, Field } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { QuotePreview } from "@/components/quotes/quote-preview";
import { calculateQuote } from "@/lib/quotes/pricing";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import type { QuoteDocumentData } from "@/lib/services/quote-document";
import type { EnquiryAnalysis, QuoteWording } from "@/lib/ai/schemas";
import type { Currency, PricingMode } from "@/generated/prisma/enums";
import { demoAnalyseAction, demoWordingAction } from "@/app/demo/actions";

const SAMPLE = "Hi, need 2 double sockets putting in the front room either side of the fireplace and the hall light changing to an LED panel. Fuse box is in the garage. Can you do it before the end of the month? Cheers, Dave";

interface Line {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  kind: "LABOUR" | "MATERIAL" | "OTHER";
  unitPriceMinor: number;
  internalCostMinor: number;
}

const STEPS = ["Enquiry", "Analysis", "Pricing", "Preview"];

export function DemoWizard({ business, settings }: { business: QuoteDocumentData["business"] & { addressLines: string[] }; settings: { currency: Currency; taxRateBps: number; taxLabel: string; pricingMode: PricingMode; callOutFeeMinor: number; validityDays: number } }) {
  const [step, setStep] = useState(0);
  const [enquiry, setEnquiry] = useState(SAMPLE);
  const [pending, start] = useTransition();
  const [analysis, setAnalysis] = useState<EnquiryAnalysis | null>(null);
  const [catalogue, setCatalogue] = useState<Array<{ id: string; name: string; unit: string; kind: string; unitPriceMinor: number; internalCostMinor: number }>>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [wording, setWording] = useState<QuoteWording | null>(null);
  // Captured once so the preview document is stable across renders (and lint-pure).
  const [issuedAt] = useState(() => new Date());

  const analyse = () =>
    start(async () => {
      const result = await demoAnalyseAction(enquiry);
      if (!result.ok) return void toast.error(result.error);
      setAnalysis(result.data.analysis);
      setCatalogue(result.data.catalogue);
      setSelected(Object.fromEntries(result.data.analysis.suggestedWork.map((_, i) => [i, true])));
      setStep(1);
    });

  const price = () => {
    if (!analysis) return;
    const next: Line[] = analysis.suggestedWork
      .filter((_, i) => selected[i])
      .map((w, i) => {
        const cat = catalogue.find((c) => c.id === w.matchedCatalogueItemId);
        return { id: `l${i}`, description: cat?.name ?? w.description, quantity: String(w.quantity ?? 1), unit: cat?.unit ?? w.unit ?? "ITEM", kind: (cat?.kind as Line["kind"]) ?? w.kind, unitPriceMinor: cat?.unitPriceMinor ?? 0, internalCostMinor: cat?.internalCostMinor ?? 0 };
      });
    setLines(next);
    setStep(2);
  };

  const totals = useMemo(() => {
    try {
      return calculateQuote({ lines: lines.map((l) => ({ quantity: l.quantity || "0", unitPriceMinor: l.unitPriceMinor, discountType: "NONE", discountValue: 0, taxTreatment: "TAXABLE", internalCostMinor: l.internalCostMinor })), pricingMode: settings.pricingMode, taxRateBps: settings.taxRateBps, discountType: "NONE", discountValue: 0, callOutFeeMinor: settings.callOutFeeMinor });
    } catch {
      return null;
    }
  }, [lines, settings]);

  const preview = () =>
    start(async () => {
      const result = await demoWordingAction({ lineItems: lines.map((l) => `${l.description} | ${l.quantity} | ${l.unit} | ${l.kind}`).join("\n"), jobSummary: analysis?.jobSummary ?? "", customerName: "Dave" });
      if (!result.ok) return void toast.error(result.error);
      setWording(result.data);
      setStep(3);
    });

  const document: QuoteDocumentData | null =
    wording && totals
      ? {
          business: { ...business, logoDataUrl: null, contactName: null },
          quote: { id: "demo", number: "QC-2026-0074", reference: null, title: wording.title, status: "DRAFT", versionNumber: 1, issuedAt, expiresAt: new Date(issuedAt.getTime() + settings.validityDays * 86_400_000), createdAt: issuedAt, currency: settings.currency },
          customer: { name: "Dave Patterson", contactName: "Dave Patterson", companyName: null, email: "dave.patterson@example.com", phone: "07700 900101", billingAddress: "14 Elm Road, Leeds, LS7 3AB" },
          jobAddress: "14 Elm Road, Leeds, LS7 3AB",
          sections: { jobSummary: wording.jobSummary, scopeOfWork: wording.scopeOfWork, includedWork: wording.includedWork, assumptions: wording.assumptions, exclusions: wording.exclusions, customerResponsibilities: wording.customerResponsibilities, paymentTerms: wording.paymentTerms, depositTerms: null, estimatedSchedule: wording.estimatedSchedule, warrantyWording: wording.warrantyWording, validityWording: wording.validityWording, customerNotes: null, customerQuestions: wording.customerQuestions },
          items: lines.map((l, i) => ({ id: l.id, description: l.description, customerDescription: null, quantity: l.quantity, unit: l.unit, unitPriceMinor: l.unitPriceMinor, lineDiscountMinor: 0, lineTotalMinor: totals.lines[i]?.lineTotalMinor ?? 0, kind: l.kind, isOptional: false })),
          totals: { subtotalMinor: totals.subtotalMinor, discountMinor: 0, discountLabel: null, callOutFeeMinor: settings.callOutFeeMinor, callOutFeeLabel: "Call-out fee", taxMinor: totals.taxMinor, taxLabel: settings.taxLabel, taxRateBps: settings.taxRateBps, totalMinor: totals.totalMinor, pricingMode: settings.pricingMode },
          acceptance: null,
          showQuoteCueBranding: false,
        }
      : null;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Demo steps">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", i === step ? "border-primary bg-primary text-white" : i < step ? "border-green-200 bg-green-50 text-success" : "bg-white text-muted-foreground")} aria-current={i === step ? "step" : undefined}>
            {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>} {s}
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Customer message</CardTitle>
            <CardDescription>Edit the sample enquiry or paste your own. Voice notes and photos are available in the full app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Enquiry" htmlFor="demo-enquiry">
              <Textarea id="demo-enquiry" value={enquiry} onChange={(e) => setEnquiry(e.target.value)} rows={6} maxLength={4000} />
            </Field>
            <Button size="lg" variant="accent" onClick={analyse} loading={pending} disabled={!enquiry.trim()}>
              <Sparkles /> Analyse with AI (demo)
            </Button>
            <p className="text-xs text-muted-foreground">The demo uses the mock AI provider with fixture responses. No paid API calls are made.</p>
          </CardContent>
        </Card>
      ) : null}
      {step === 1 && analysis ? (
        <div className="space-y-4">
          <Alert variant={analysis.readiness.level === "ready" ? "success" : "warning"} title={analysis.readiness.level === "ready" ? "Ready to quote" : "Needs confirmation"}>
            {analysis.readiness.explanation}
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Suggested work</CardTitle>
              <CardDescription>{analysis.jobSummary}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {analysis.suggestedWork.map((w, i) => (
                  <li key={i} className="flex items-start gap-3 py-3">
                    <input id={`d-${i}`} type="checkbox" checked={!!selected[i]} onChange={(e) => setSelected({ ...selected, [i]: e.target.checked })} className="mt-1 size-4 accent-primary" />
                    <div>
                      <label htmlFor={`d-${i}`} className="font-semibold">
                        {w.description}
                      </label>
                      {w.detail ? <p className="text-sm text-muted-foreground">{w.detail}</p> : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline">{w.source}</Badge>
                        <Badge variant={w.confidence === "high" ? "success" : "warning"}>{w.confidence} confidence</Badge>
                        {w.matchedCatalogueItemName ? <Badge variant="info">Matched: {w.matchedCatalogueItemName}</Badge> : <Badge variant="warning">Unpriced</Badge>}
                        {w.requiresConfirmation ? <Badge variant="muted">Confirm with customer</Badge> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Customer questions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm">
                  {analysis.customerQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Assumptions and uncertainties</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm">
                  {analysis.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {analysis.uncertainties.map((u) => (
                    <li key={u.description}>{u.description}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button size="lg" onClick={price}>
              Price the work <ArrowRight />
            </Button>
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
              <CardDescription>Prices come from the demo catalogue. Edit quantities and prices freely; arithmetic is deterministic.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {lines.map((l, i) => (
                <div key={l.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-12 md:items-center">
                  <Input value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className="h-9 md:col-span-6" aria-label="Description" />
                  <Input value={l.quantity} inputMode="decimal" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="h-9 text-right md:col-span-2" aria-label="Quantity" />
                  <Input value={(l.unitPriceMinor / 100).toFixed(2)} inputMode="decimal" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitPriceMinor: Math.round(Number(e.target.value || 0) * 100) } : x)))} className="h-9 text-right md:col-span-2" aria-label="Unit price" />
                  <p className="text-right text-sm font-semibold tabular md:col-span-2">{totals ? formatMoney(totals.lines[i]?.lineTotalMinor ?? 0, settings.currency) : "—"}</p>
                </div>
              ))}
              {totals ? (
                <dl className="ml-auto max-w-xs space-y-1 pt-2 text-sm">
                  <div className="flex justify-between">
                    <dt>Subtotal (incl. call-out)</dt>
                    <dd className="tabular">{formatMoney(totals.subtotalMinor, settings.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{settings.taxLabel}</dt>
                    <dd className="tabular">{formatMoney(totals.taxMinor, settings.currency)}</dd>
                  </div>
                  <div className="flex justify-between border-t-2 border-foreground pt-1 text-base font-bold">
                    <dt>Total</dt>
                    <dd className="tabular">{formatMoney(totals.totalMinor, settings.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <dt>Margin (internal)</dt>
                    <dd>{totals.marginPercent}%</dd>
                  </div>
                </dl>
              ) : null}
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="lg" onClick={preview} loading={pending}>
              Generate wording and preview <ArrowRight />
            </Button>
          </div>
        </div>
      ) : null}
      {step === 3 && document ? (
        <div className="space-y-4">
          <Alert variant="success" title="Your quote is ready">
            In the full app you would download the PDF, email it or share a secure acceptance link from here.
          </Alert>
          <QuotePreview data={document} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back to pricing
            </Button>
            <Button asChild size="lg" variant="accent">
              <a href="/signup">Create my first real quote</a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
