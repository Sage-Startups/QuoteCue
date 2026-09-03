"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/utils/result";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Alert } from "@/components/ui/misc";
import { saveTemplateAction } from "@/app/app/templates/actions";

export interface TemplateValues {
  id?: string;
  name: string;
  description: string;
  defaultTitle: string;
  scopeOfWork: string;
  includedWork: string;
  assumptions: string;
  exclusions: string;
  customerResponsibilities: string;
  paymentTerms: string;
  warrantyWording: string;
  estimatedSchedule: string;
  customerQuestions: string;
  isDefault: boolean;
}

const SECTIONS: Array<{ key: keyof TemplateValues; label: string; rows?: number; hint?: string }> = [
  { key: "defaultTitle", label: "Default quote title" },
  { key: "scopeOfWork", label: "Scope of work", rows: 3 },
  { key: "includedWork", label: "Included work", rows: 3, hint: "One item per line, starting with -" },
  { key: "assumptions", label: "Assumptions", rows: 3, hint: "One per line" },
  { key: "exclusions", label: "Exclusions", rows: 3, hint: "One per line" },
  { key: "customerResponsibilities", label: "Customer responsibilities", rows: 2 },
  { key: "paymentTerms", label: "Payment terms", rows: 2 },
  { key: "warrantyWording", label: "Warranty wording", rows: 2 },
  { key: "estimatedSchedule", label: "Estimated schedule", rows: 2 },
  { key: "customerQuestions", label: "Common customer questions", rows: 3, hint: "One per line" },
];

export function TemplateDialog({ initial, disabled }: { initial?: TemplateValues; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult<{ id: string }> | null, fd: FormData) => {
    const result = await saveTemplateAction(prev, fd);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, null);
  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
  return (
    <>
      {initial?.id ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={disabled}>
          <Plus /> New template
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{initial?.id ? "Edit template" : "New quote template"}</DialogTitle>
            <DialogDescription>Default wording applied to new quotes. AI uses it as guidance and you can edit every section per quote.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4" noValidate>
            {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
            {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Template name" htmlFor="t-name" required error={err("name")}>
                <Input id="t-name" name="name" defaultValue={initial?.name} required />
              </Field>
              <Field label="Description" htmlFor="t-description" error={err("description")}>
                <Input id="t-description" name="description" defaultValue={initial?.description} />
              </Field>
            </div>
            {SECTIONS.map((s) => (
              <Field key={s.key} label={s.label} htmlFor={`t-${s.key}`} hint={s.hint} error={err(s.key)}>
                {s.rows ? <Textarea id={`t-${s.key}`} name={s.key} defaultValue={String(initial?.[s.key] ?? "")} rows={s.rows} /> : <Input id={`t-${s.key}`} name={s.key} defaultValue={String(initial?.[s.key] ?? "")} />}
              </Field>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDefault" defaultChecked={initial?.isDefault} className="size-4 accent-primary" /> Use as the default template for new quotes
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
