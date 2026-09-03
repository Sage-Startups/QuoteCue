"use client";

import * as React from "react";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { Field } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/utils/result";
import { CURRENCY_OPTIONS, type SettingFieldSpec } from "@/app/super-admin/_lib/settings-fields";

type SaveAction = (prev: ActionResult<{ changed: string[] }> | null, formData: FormData) => Promise<ActionResult<{ changed: string[] }>>;

function ColorInput({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  const [value, setValue] = React.useState(defaultValue);
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input type="color" aria-label="Pick colour" value={valid ? value : "#000000"} onChange={(e) => setValue(e.target.value)} className="size-10 cursor-pointer rounded-lg border border-input bg-white p-1" />
      <Input id={id} name={name} value={value} onChange={(e) => setValue(e.target.value)} pattern="^#[0-9a-fA-F]{6}$" className="max-w-[10rem] font-mono" />
      <span className="size-6 rounded-full border" style={{ backgroundColor: valid ? value : "transparent" }} aria-hidden="true" />
    </div>
  );
}

function SettingInput({ field, renderAsset }: { field: SettingFieldSpec; renderAsset?: (field: SettingFieldSpec) => React.ReactNode }) {
  const error = useFieldError(field.key);
  const id = `setting-${field.key.replace(/\./g, "-")}`;
  const v = field.value;
  switch (field.kind) {
    case "boolean":
      return (
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="inline-flex items-center gap-2 text-sm font-medium">
            <input id={id} name={field.key} type="checkbox" defaultChecked={v === true} className="size-4 rounded border-input accent-primary" />
            {field.label}
          </label>
          <p className="text-xs text-muted-foreground">{field.description}</p>
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>
      );
    case "number":
      return (
        <Field label={field.label} htmlFor={id} error={error} hint={field.description}>
          <Input id={id} name={field.key} type="number" step="any" defaultValue={typeof v === "number" ? v : ""} inputMode="decimal" />
        </Field>
      );
    case "textarea":
      return (
        <Field label={field.label} htmlFor={id} error={error} hint={field.description}>
          <Textarea id={id} name={field.key} rows={3} defaultValue={typeof v === "string" ? v : ""} placeholder={field.placeholder} />
        </Field>
      );
    case "color":
      return (
        <Field label={field.label} htmlFor={id} error={error} hint={field.description}>
          <ColorInput id={id} name={field.key} defaultValue={typeof v === "string" ? v : "#000000"} />
        </Field>
      );
    case "email":
      return (
        <Field label={field.label} htmlFor={id} error={error} hint={field.description}>
          <Input id={id} name={field.key} type="email" defaultValue={typeof v === "string" ? v : ""} placeholder={field.placeholder} />
        </Field>
      );
    case "list":
      return (
        <Field label={field.label} htmlFor={id} error={error} hint={`${field.description} Comma-separated.`}>
          <Textarea id={id} name={field.key} rows={2} defaultValue={Array.isArray(v) ? v.join(", ") : ""} />
        </Field>
      );
    case "currencies": {
      const selected = Array.isArray(v) ? (v as string[]) : [];
      return (
        <fieldset>
          <legend className="text-sm font-medium">{field.label}</legend>
          <p className="text-xs text-muted-foreground">{field.description}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {CURRENCY_OPTIONS.map((c) => (
              <label key={c} htmlFor={`${id}-${c}`} className="inline-flex items-center gap-1.5 text-sm">
                <input id={`${id}-${c}`} name={field.key} value={c} type="checkbox" defaultChecked={selected.includes(c)} className="size-4 rounded border-input accent-primary" />
                {c}
              </label>
            ))}
          </div>
          {error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null}
        </fieldset>
      );
    }
    case "object": {
      const obj = (v && typeof v === "object" ? v : {}) as Record<string, string>;
      return (
        <fieldset>
          <legend className="text-sm font-medium">{field.label}</legend>
          <p className="text-xs text-muted-foreground">{field.description}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(field.objectKeys ?? Object.keys(obj)).map((sub) => (
              <div key={sub} className="flex flex-col gap-1">
                <label htmlFor={`${id}-${sub}`} className="text-xs font-medium text-muted-foreground">
                  {sub.replace(/_/g, " ")}
                </label>
                <Input id={`${id}-${sub}`} name={`${field.key}.${sub}`} defaultValue={obj[sub] ?? ""} placeholder={field.key.endsWith("socialLinks") ? "https://…" : undefined} />
              </div>
            ))}
          </div>
          {error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null}
        </fieldset>
      );
    }
    case "asset":
      return (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{field.label}</p>
          <p className="text-xs text-muted-foreground">{field.description}</p>
          <div className="mt-1">{renderAsset ? renderAsset(field) : <Input id={id} name={field.key} defaultValue={typeof v === "string" ? v : ""} />}</div>
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>
      );
    default:
      return (
        <Field label={field.label} htmlFor={id} error={error} hint={field.description}>
          <Input id={id} name={field.key} defaultValue={typeof v === "string" ? v : ""} placeholder={field.placeholder} />
        </Field>
      );
  }
}

/** Renders a group of site settings and submits them through `saveSettingsAction`. */
export function SettingsForm({ fields, action, returnPath, submitLabel = "Save settings", renderAsset, columns = 1 }: { fields: SettingFieldSpec[]; action: SaveAction; returnPath: string; submitLabel?: string; renderAsset?: (field: SettingFieldSpec) => React.ReactNode; columns?: 1 | 2 }) {
  return (
    <ActionForm action={action} hidden={{ keys: fields.map((f) => f.key).join(","), returnPath }} submitLabel={submitLabel} className="space-y-4">
      <div className={columns === 2 ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
        {fields.map((f) => (
          <SettingInput key={f.key} field={f} renderAsset={renderAsset} />
        ))}
      </div>
    </ActionForm>
  );
}
