"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw, Send, RefreshCw } from "lucide-react";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/app/confirm-button";
import { HtmlPreview } from "@/components/admin/misc";
import { Button } from "@/components/ui/button";
import { Field, Alert } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/utils/result";
import { previewEmailTemplateAction, resetEmailTemplateAction, saveEmailTemplateAction, sendTestEmailAction, type EmailPreviewResult } from "../actions";

export interface EmailTemplateEditorProps {
  kind: string;
  initial: { name: string; subject: string; previewText: string; bodyMarkdown: string; enabled: boolean };
  variables: string[];
  customised: boolean;
  initialPreview: EmailPreviewResult;
  adminEmail: string;
}

const FORM_ID = "email-template-form";

function TextField({ id, name, label, defaultValue, hint, required }: { id: string; name: string; label: string; defaultValue: string; hint?: string; required?: boolean }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <Input id={id} name={name} defaultValue={defaultValue} required={required} />
    </Field>
  );
}

function BodyField({ defaultValue }: { defaultValue: string }) {
  const error = useFieldError("bodyMarkdown");
  return (
    <Field label="Body (Markdown)" htmlFor="tpl-body" required error={error} hint="Headings, paragraphs, lists, bold, italic and links. A paragraph containing only a link renders as a button.">
      <Textarea id="tpl-body" name="bodyMarkdown" rows={18} defaultValue={defaultValue} required className="font-mono text-xs" />
    </Field>
  );
}

function collectForm(kind: string): FormData {
  const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
  const fd = new FormData(form ?? undefined);
  fd.set("kind", kind);
  return fd;
}

export function EmailTemplateEditor({ kind, initial, variables, customised, initialPreview, adminEmail }: EmailTemplateEditorProps) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preview, previewAction, previewPending] = useActionState<ActionResult<EmailPreviewResult> | null, FormData>(previewEmailTemplateAction, null);
  const [testState, testAction, testPending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const result = await sendTestEmailAction(prev, fd);
    if (result.ok) toast.success(result.message ?? "Sent");
    else toast.error(result.error);
    return result;
  }, null);
  const [, startTransition] = useTransition();

  const refreshPreview = () => startTransition(() => previewAction(collectForm(kind)));
  const scheduleRefresh = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refreshPreview, 700);
  };
  const current = preview?.ok ? preview.data : initialPreview;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-4">
        <ActionForm id={FORM_ID} action={saveEmailTemplateAction} hidden={{ kind }} submitLabel="Save template" className="space-y-4" onChange={scheduleRefresh}>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="tpl-name" name="name" label="Template name" defaultValue={initial.name} required />
            <label htmlFor="tpl-enabled" className="inline-flex items-center gap-2 self-end pb-2.5 text-sm">
              <input id="tpl-enabled" name="enabled" type="checkbox" defaultChecked={initial.enabled} className="size-4 rounded border-input accent-primary" />
              Enabled (disabled templates are skipped and logged)
            </label>
          </div>
          <TextField id="tpl-subject" name="subject" label="Subject" defaultValue={initial.subject} required />
          <TextField id="tpl-preview" name="previewText" label="Preview text" defaultValue={initial.previewText} hint="Shown by inbox clients next to the subject." />
          <BodyField defaultValue={initial.bodyMarkdown} />
          <div>
            <p className="text-sm font-medium">Available variables</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {variables.map((v) => (
                <code key={v} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{`{{${v}}}`}</code>
              ))}
            </div>
          </div>
        </ActionForm>
        <ConfirmButton action={resetEmailTemplateAction} hidden={{ kind }} variant="outline" disabled={!customised} confirmTitle="Reset to the built-in default?" confirmDescription="Your customised subject and body are removed. This is recorded in the audit log." confirmLabel="Reset">
          <RotateCcw /> Reset to default
        </ConfirmButton>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Live preview</p>
            <p className="text-xs text-muted-foreground">Rendered on the server with sample values and current branding. Updates shortly after you stop typing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" loading={previewPending} onClick={refreshPreview}>
              <RefreshCw /> Refresh
            </Button>
            <Button type="button" size="sm" loading={testPending} onClick={() => startTransition(() => testAction(collectForm(kind)))}>
              <Send /> Send test to me
            </Button>
          </div>
        </div>
        {preview && !preview.ok ? (
          <Alert variant="destructive">
            {preview.error}
            {preview.fieldErrors ? ` ${Object.values(preview.fieldErrors).flat().join(" ")}` : ""}
          </Alert>
        ) : null}
        {testState && !testState.ok ? <Alert variant="destructive">{testState.error}</Alert> : null}
        <p className="text-xs text-muted-foreground">Test emails are sent to {adminEmail} using the values currently in the form.</p>
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Subject: </span>
          {current.subject}
        </p>
        <HtmlPreview html={current.html} title="Email preview" className="h-[36rem]" />
      </div>
    </div>
  );
}
