"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, AlertTriangle, HelpCircle, Camera, ShieldAlert, ClipboardCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { analyseAction, applySuggestionsAction } from "@/app/app/quotes/[id]/edit/actions";
import type { EnquiryAnalysis } from "@/lib/ai/schemas";
import type { WizardData } from "./types";
import { cn } from "@/lib/utils/cn";

const CONF: Record<string, "success" | "warning" | "destructive"> = { high: "success", medium: "warning", low: "destructive" };
const SOURCE_LABEL: Record<string, string> = { message: "From message", notes: "From notes", voice: "From voice note", photo: "From photo", document: "From document", inference: "Inferred" };

export function StepAnalysis({ data, catalogue }: { data: WizardData; catalogue: Array<{ id: string; name: string; category: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [analysis, setAnalysis] = useState<EnquiryAnalysis | null>(data.analysis);
  const [credits, setCredits] = useState(data.entitlements.aiAvailable);
  const [selected, setSelected] = useState<Record<number, { checked: boolean; quantity: string; catalogueItemId: string | null }>>(() => initSelection(data.analysis));

  function initSelection(a: EnquiryAnalysis | null) {
    const out: Record<number, { checked: boolean; quantity: string; catalogueItemId: string | null }> = {};
    a?.suggestedWork.forEach((w, i) => {
      out[i] = { checked: true, quantity: w.quantity !== null ? String(w.quantity) : "1", catalogueItemId: w.matchedCatalogueItemId };
    });
    return out;
  }

  const run = () =>
    start(async () => {
      const result = await analyseAction(data.quote.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Analysis complete");
      setAnalysis(result.data.analysis);
      setCredits(result.data.creditsRemaining);
      setSelected(initSelection(result.data.analysis));
    });

  const apply = () =>
    start(async () => {
      const chosen = Object.entries(selected)
        .filter(([, v]) => v.checked)
        .map(([i, v]) => ({ index: Number(i), quantity: v.quantity, catalogueItemId: v.catalogueItemId }));
      const result = await applySuggestionsAction(data.quote.id, chosen);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Items added");
      router.push(`/app/quotes/${data.quote.id}/edit?step=4`);
      router.refresh();
    });

  const hasInput = !!(data.quote.enquiryText || data.quote.jobNotes || data.quote.transcript || data.media.length > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" aria-hidden="true" /> AI analysis
          </CardTitle>
          <CardDescription>
            Reads the message, notes, transcript and photographs, then proposes work matched to your catalogue. One AI generation is used only when the analysis succeeds. You have <strong>{credits}</strong> remaining.
            {data.aiProvider === "mock" ? " Mock AI provider active (no API key): responses are realistic fixtures." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="lg" variant="accent" onClick={run} loading={pending} disabled={!hasInput || credits <= 0}>
            {analysis ? <RefreshCw /> : <Sparkles />} {analysis ? "Run analysis again" : "Analyse with AI"}
          </Button>
          {!hasInput ? (
            <Button variant="secondary" onClick={() => router.push(`/app/quotes/${data.quote.id}/edit?step=2`)}>
              Add an enquiry first
            </Button>
          ) : null}
          {credits <= 0 ? (
            <Alert variant="warning" className="basis-full">
              No AI generations left.{" "}
              <a href="/app/billing" className="font-semibold underline">
                Upgrade or buy credits
              </a>{" "}
              or price the work manually.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {pending && !analysis ? (
        <div className="space-y-3" aria-live="polite">
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <p className="text-center text-sm text-muted-foreground">Reading the enquiry and matching work to your catalogue…</p>
        </div>
      ) : null}

      {analysis ? (
        <>
          <Alert
            variant={analysis.readiness.level === "ready" ? "success" : analysis.readiness.level === "needs_confirmation" ? "warning" : "destructive"}
            title={analysis.readiness.level === "ready" ? "Ready to quote" : analysis.readiness.level === "needs_confirmation" ? "Needs confirmation before sending" : "On-site inspection recommended"}
          >
            {analysis.readiness.explanation}
            {analysis.recommendOnsiteInspection && analysis.inspectionReason ? ` ${analysis.inspectionReason}` : ""}
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Job summary</CardTitle>
              {analysis.detectedTrade ? <CardDescription>Detected trade: {analysis.detectedTrade}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              <p className="text-sm">{analysis.jobSummary}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Suggested work</CardTitle>
              <CardDescription>Tick the items to add. Anything without a catalogue match is added unpriced for you to price. AI never sets a price.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {analysis.suggestedWork.map((w, i) => {
                  const sel = selected[i] ?? { checked: true, quantity: "1", catalogueItemId: w.matchedCatalogueItemId };
                  return (
                    <li key={i} className={cn("flex flex-col gap-3 py-4 sm:flex-row", !sel.checked && "opacity-60")}>
                      <div className="flex items-start gap-3 sm:flex-1">
                        <Checkbox id={`sw-${i}`} checked={sel.checked} onCheckedChange={(v) => setSelected({ ...selected, [i]: { ...sel, checked: !!v } })} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <label htmlFor={`sw-${i}`} className="font-semibold">
                            {w.description}
                          </label>
                          {w.detail ? <p className="text-sm text-muted-foreground">{w.detail}</p> : null}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge variant="outline">{SOURCE_LABEL[w.source] ?? w.source}</Badge>
                            <Badge variant={CONF[w.confidence]}>{w.confidence} confidence</Badge>
                            <Badge variant="muted">{w.kind.toLowerCase()}</Badge>
                            {w.requiresConfirmation ? <Badge variant="warning">Confirm with customer</Badge> : null}
                            {w.quantitySource === "estimated" ? <Badge variant="warning">Quantity estimated</Badge> : w.quantitySource === "unknown" ? <Badge variant="muted">Quantity unknown</Badge> : null}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr] gap-2 sm:w-80">
                        <div>
                          <label htmlFor={`qty-${i}`} className="text-xs font-medium text-muted-foreground">
                            Qty{w.unit ? ` (${w.unit.toLowerCase().replace("_", " ")})` : ""}
                          </label>
                          <Input id={`qty-${i}`} inputMode="decimal" value={sel.quantity} onChange={(e) => setSelected({ ...selected, [i]: { ...sel, quantity: e.target.value } })} className="h-9" />
                        </div>
                        <div>
                          <label htmlFor={`cat-${i}`} className="text-xs font-medium text-muted-foreground">
                            Catalogue item
                          </label>
                          <Select id={`cat-${i}`} value={sel.catalogueItemId ?? ""} onChange={(e) => setSelected({ ...selected, [i]: { ...sel, catalogueItemId: e.target.value || null } })} className={cn("h-9 md:h-9", !sel.catalogueItemId && "border-amber-400")}>
                            <option value="">Unpriced — set price later</option>
                            {catalogue.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                          {w.matchedCatalogueItemName && w.matchConfidence ? <p className="mt-0.5 text-[11px] text-muted-foreground">Suggested match: {w.matchedCatalogueItemName} ({w.matchConfidence})</p> : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {analysis.suggestedWork.length === 0 ? <p className="text-sm text-muted-foreground">No work items were identified. Add more detail or price manually.</p> : null}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard icon={AlertTriangle} title="Uncertainties and assumptions" items={[...analysis.uncertainties.map((u) => `${u.description} (${u.confidence})`), ...analysis.assumptions.map((a) => `Assumes: ${a}`)]} />
            <ListCard icon={HelpCircle} title="Missing information and customer questions" items={[...analysis.missingInformation.map((m) => `Missing: ${m}`), ...analysis.customerQuestions]} />
            {analysis.photoObservations.length > 0 ? (
              <ListCard icon={Camera} title="Photograph observations" items={analysis.photoObservations.map((p) => `${p.mediaIndex !== null ? `Photo ${p.mediaIndex + 1}: ` : ""}${p.observation}${p.caveat ? ` — ${p.caveat}` : ""} (${p.confidence})`)} />
            ) : null}
            {analysis.safetyNotes.length > 0 ? <ListCard icon={ShieldAlert} title="Safety notes" items={analysis.safetyNotes} /> : null}
          </div>
          <Alert variant="info" title="How to read this">
            Photographs can only show what is visible. AI never claims a photo proves hidden conditions, compliance, safety, exact measurements or quantities, and it never sets a price. Confirm anything marked for confirmation before sending.
          </Alert>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => router.push(`/app/quotes/${data.quote.id}/edit?step=2`)}>
              Back
            </Button>
            <Button size="lg" onClick={apply} loading={pending} className="h-auto min-h-11 whitespace-normal py-2 text-center">
              <ClipboardCheck /> Add selected items and price the work
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ListCard({ icon: Icon, title, items }: { icon: typeof AlertTriangle; title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing flagged.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
