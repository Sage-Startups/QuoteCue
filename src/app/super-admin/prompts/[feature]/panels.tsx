"use client";

import { useActionState } from "react";
import { CheckCircle2, FlaskConical, Plus, Trash2, Undo2 } from "lucide-react";
import { ConfirmButton } from "@/components/app/confirm-button";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { JsonBlock } from "@/components/admin/misc";
import { formatUsdMicros } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Alert } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/utils/result";
import { createPromptVersionAction, deletePromptVersionAction, publishPromptVersionAction, testPromptAction, updatePromptVersionAction, type PromptTestOutput } from "../actions";

export interface PromptVersionSummary {
  id: string;
  version: number;
  isPublished: boolean;
  model: string | null;
  notes: string | null;
}

export function NewVersionButton({ feature }: { feature: string }) {
  return (
    <ConfirmButton action={createPromptVersionAction} hidden={{ feature }} variant="secondary">
      <Plus /> New version
    </ConfirmButton>
  );
}

export function VersionActions({ version, publishedVersion }: { version: PromptVersionSummary; publishedVersion: number | null }) {
  const isRollback = publishedVersion !== null && version.version < publishedVersion;
  if (version.isPublished) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmButton action={publishPromptVersionAction} hidden={{ versionId: version.id }} variant={isRollback ? "outline" : "default"} confirmTitle={isRollback ? `Roll back to version ${version.version}?` : `Publish version ${version.version}?`} confirmDescription="The currently published version is unpublished and every new AI run uses this version immediately." confirmLabel={isRollback ? "Roll back" : "Publish"}>
        {isRollback ? <Undo2 /> : <CheckCircle2 />} {isRollback ? "Roll back to this version" : "Publish"}
      </ConfirmButton>
      <ConfirmButton action={deletePromptVersionAction} hidden={{ versionId: version.id }} variant="ghost" confirmTitle={`Delete version ${version.version}?`} confirmDescription="The prompt text is kept in the audit log." confirmLabel="Delete">
        <Trash2 /> Delete
      </ConfirmButton>
    </div>
  );
}

function PromptTextarea({ id, name, label, defaultValue, rows, readOnly }: { id: string; name: string; label: string; defaultValue: string; rows: number; readOnly: boolean }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={id} error={error}>
      <Textarea id={id} name={name} defaultValue={defaultValue} rows={rows} readOnly={readOnly} className="font-mono text-xs" />
    </Field>
  );
}

function ModelField({ defaultValue, placeholder, readOnly }: { defaultValue: string; placeholder: string; readOnly: boolean }) {
  const error = useFieldError("model");
  return (
    <Field label="Model override" htmlFor="prompt-model" error={error} hint="Blank uses the configured text or vision model.">
      <Input id="prompt-model" name="model" defaultValue={defaultValue} placeholder={placeholder} readOnly={readOnly} />
    </Field>
  );
}

export function PromptVersionForm({ version, variables, modelPlaceholder }: { version: PromptVersionSummary & { systemPrompt: string; userTemplate: string }; variables: string[]; modelPlaceholder: string }) {
  const readOnly = version.isPublished;
  return (
    <ActionForm key={version.id} action={updatePromptVersionAction} hidden={{ versionId: version.id }} submitLabel="Save version" className="space-y-4" footer={readOnly ? <span className="text-xs text-muted-foreground">Published versions are read-only. Create a new version to edit.</span> : null}>
      <div>
        <p className="text-sm font-medium">Available variables</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {variables.map((v) => (
            <code key={v} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{`{{${v}}}`}</code>
          ))}
        </div>
      </div>
      <PromptTextarea id="system-prompt" name="systemPrompt" label="System prompt" defaultValue={version.systemPrompt} rows={12} readOnly={readOnly} />
      <PromptTextarea id="user-template" name="userTemplate" label="User template" defaultValue={version.userTemplate} rows={14} readOnly={readOnly} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ModelField defaultValue={version.model ?? ""} placeholder={modelPlaceholder} readOnly={readOnly} />
        <Field label="Notes" htmlFor="prompt-notes" hint="What changed and why.">
          <Input id="prompt-notes" name="notes" defaultValue={version.notes ?? ""} readOnly={readOnly} maxLength={1000} />
        </Field>
      </div>
    </ActionForm>
  );
}

export function PromptTester({ feature, versions, defaultVersionId }: { feature: string; versions: PromptVersionSummary[]; defaultVersionId: string }) {
  const [state, action, pending] = useActionState<ActionResult<PromptTestOutput> | null, FormData>(testPromptAction, null);
  const inputError = state && !state.ok ? state.fieldErrors?.input?.[0] : undefined;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="feature" value={feature} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <Field label="Prompt version" htmlFor="test-version">
            <Select id="test-version" name="versionId" defaultValue={defaultVersionId}>
              <option value="">Built-in default</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                  {v.isPublished ? " (published)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Sample input" htmlFor="test-input" required error={inputError} hint="Use sanitised sample data only. No credits are consumed and the run is logged as a prompt test.">
          <Textarea id="test-input" name="input" rows={6} required maxLength={8000} placeholder="e.g. hi mate, need 2 double sockets putting in the front room…" />
        </Field>
        <Button type="submit" loading={pending} variant="secondary">
          <FlaskConical /> Run test
        </Button>
      </form>
      {state && !state.ok && !inputError ? <Alert variant="destructive">{state.error}</Alert> : null}
      {state?.ok ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={state.data.provider === "mock" ? "warning" : "success"}>{state.data.provider === "mock" ? "Mock provider" : "OpenAI"}</Badge>
            <span className="font-mono">{state.data.model}</span>
            <span>· {state.data.versionLabel}</span>
            <span>
              · {state.data.inputTokens} in / {state.data.outputTokens} out tokens
            </span>
            <span>· {formatUsdMicros(state.data.estimatedCostMicros, { precise: true })}</span>
          </div>
          <JsonBlock value={state.data.output} maxHeight="24rem" />
        </div>
      ) : null}
    </div>
  );
}
