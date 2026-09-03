"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generateWordingAction, regenerateSectionAction, saveWordingAction } from "@/app/app/quotes/[id]/edit/actions";
import type { WizardData, WizardWording } from "./types";

const SECTIONS: Array<{ key: keyof Omit<WizardWording, "customerQuestions">; label: string; rows: number; hint?: string; regenerable: boolean }> = [
  { key: "title", label: "Quote title", rows: 1, regenerable: true },
  { key: "jobSummary", label: "Job summary", rows: 3, regenerable: true },
  { key: "scopeOfWork", label: "Scope of work", rows: 5, regenerable: true },
  { key: "includedWork", label: "Included work", rows: 4, hint: "One item per line starting with -", regenerable: true },
  { key: "assumptions", label: "Assumptions", rows: 4, hint: "One per line", regenerable: true },
  { key: "exclusions", label: "Exclusions", rows: 4, hint: "One per line", regenerable: true },
  { key: "customerResponsibilities", label: "Customer responsibilities", rows: 3, regenerable: true },
  { key: "paymentTerms", label: "Payment terms", rows: 3, regenerable: true },
  { key: "estimatedSchedule", label: "Estimated schedule", rows: 2, regenerable: true },
  { key: "warrantyWording", label: "Warranty wording", rows: 2, regenerable: true },
  { key: "validityWording", label: "Quote validity", rows: 2, regenerable: true },
  { key: "customerNotes", label: "Notes to customer", rows: 2, regenerable: false },
  { key: "followUpEmail", label: "Follow-up email", rows: 7, hint: "Sent with the quote. Use [QUOTE LINK] where the link should appear.", regenerable: true },
];

export function StepWording({ data }: { data: WizardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wording, setWording] = useState<WizardWording>(data.wording);
  const [credits, setCredits] = useState(data.entitlements.aiAvailable);
  const [regen, setRegen] = useState<string | null>(null);
  const [instruction, setInstruction] = useState<Record<string, string>>({});
  const [newQuestion, setNewQuestion] = useState("");
  const hasWording = !!(wording.scopeOfWork || wording.includedWork);

  const generate = () =>
    start(async () => {
      const result = await generateWordingAction(data.quote.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Wording generated");
      setWording({ ...result.data.wording, customerNotes: wording.customerNotes });
      setCredits(result.data.creditsRemaining);
    });

  const regenerate = async (key: string) => {
    setRegen(key);
    const result = await regenerateSectionAction(data.quote.id, key, instruction[key] ?? "");
    setRegen(null);
    if (!result.ok) {
        toast.error(result.error);
        return;
      }
    setWording((w) => ({ ...w, [key]: result.data.content }));
    toast.success(`${SECTIONS.find((s) => s.key === key)?.label ?? "Section"} regenerated`);
  };

  const save = (nextStep: number) =>
    start(async () => {
      const result = await saveWordingAction(data.quote.id, wording);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/app/quotes/${data.quote.id}/edit?step=${nextStep}`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {data.quote.isLocked ? <Alert variant="warning">This version is locked because it was accepted. Create a revision from the quote page to change wording.</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" aria-hidden="true" /> Generate wording
          </CardTitle>
          <CardDescription>
            Writes every section from your confirmed line items and analysis. Uses one AI generation on success ({credits} remaining). Regenerating a single section is free. Everything is editable.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="lg" variant="accent" onClick={generate} loading={pending} disabled={credits <= 0 || data.quote.isLocked}>
            <Sparkles /> {hasWording ? "Regenerate all sections" : "Generate all sections"}
          </Button>
          {credits <= 0 ? (
            <p className="basis-full text-sm text-muted-foreground">
              No AI generations left. You can still write or edit every section by hand.{" "}
              <a href="/app/billing" className="font-semibold underline">
                Get more
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`w-${s.key}`} className="text-base font-semibold">
                  {s.label}
                </label>
                {s.regenerable && !data.quote.isLocked ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <label htmlFor={`instr-${s.key}`} className="sr-only">
                      Instruction for regenerating {s.label}
                    </label>
                    <Input id={`instr-${s.key}`} value={instruction[s.key] ?? ""} onChange={(e) => setInstruction({ ...instruction, [s.key]: e.target.value })} placeholder="Optional: e.g. make it shorter" className="h-8 w-52 text-xs" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => regenerate(s.key)} disabled={regen !== null || pending} loading={regen === s.key}>
                      <RefreshCw /> Regenerate
                    </Button>
                  </div>
                ) : null}
              </div>
              {s.hint ? <CardDescription>{s.hint}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              {s.rows === 1 ? (
                <Input id={`w-${s.key}`} value={wording[s.key]} onChange={(e) => setWording({ ...wording, [s.key]: e.target.value })} maxLength={120} disabled={data.quote.isLocked} />
              ) : (
                <Textarea id={`w-${s.key}`} value={wording[s.key]} onChange={(e) => setWording({ ...wording, [s.key]: e.target.value })} rows={s.rows} disabled={data.quote.isLocked} />
              )}
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Customer questions</CardTitle>
            <CardDescription>Questions to ask before or after sending. These are kept with the quote for your reference.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-1.5">
              {wording.customerQuestions.map((q, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input value={q} onChange={(e) => setWording({ ...wording, customerQuestions: wording.customerQuestions.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Question ${i + 1}`} className="h-9" />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setWording({ ...wording, customerQuestions: wording.customerQuestions.filter((_, j) => j !== i) })} aria-label="Remove question">
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Add a question" aria-label="New question" className="h-9" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (newQuestion.trim()) setWording({ ...wording, customerQuestions: [...wording.customerQuestions, newQuestion.trim()] });
                  setNewQuestion("");
                }}
              >
                <Plus /> Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => router.push(`/app/quotes/${data.quote.id}/edit?step=4`)}>
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => save(5)} loading={pending} disabled={data.quote.isLocked}>
            Save
          </Button>
          <Button size="lg" onClick={() => (data.quote.isLocked ? router.push(`/app/quotes/${data.quote.id}/edit?step=6`) : save(6))} loading={pending}>
            Save and review
          </Button>
        </div>
      </div>
    </div>
  );
}
