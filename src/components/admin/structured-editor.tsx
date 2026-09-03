"use client";

import * as React from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const LONG_TEXT_KEYS = new Set(["description", "answer", "body", "before", "example", "quote", "note", "footnote"]);

function labelFor(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function isPlainObject(v: JsonValue): v is { [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function templateFrom(sample: JsonValue): JsonValue {
  if (Array.isArray(sample)) return [];
  if (isPlainObject(sample)) return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, templateFrom(v)]));
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  return "";
}

function StringField({ id, label, value, onChange, keyName }: { id: string; label: string; value: string; onChange: (v: string) => void; keyName: string }) {
  const long = value.length > 80 || LONG_TEXT_KEYS.has(keyName);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {long ? <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={Math.min(12, Math.max(3, Math.ceil(value.length / 90)))} /> : <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

function ValueEditor({ id, keyName, value, onChange, depth }: { id: string; keyName: string; value: JsonValue; onChange: (v: JsonValue) => void; depth: number }) {
  const label = labelFor(keyName);
  if (typeof value === "string") return <StringField id={id} label={label} keyName={keyName} value={value} onChange={onChange} />;
  if (typeof value === "number") {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Input id={id} type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    );
  }
  if (typeof value === "boolean") {
    return (
      <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
        <input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-input accent-primary" />
        {label}
      </label>
    );
  }
  if (value === null) return <StringField id={id} label={label} keyName={keyName} value="" onChange={(v) => onChange(v || null)} />;
  if (Array.isArray(value)) {
    const allStrings = value.every((v) => typeof v === "string");
    if (allStrings) {
      return (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-sm font-medium">
            {label} <span className="font-normal text-muted-foreground">(one per line)</span>
          </label>
          <Textarea id={id} value={(value as string[]).join("\n")} onChange={(e) => onChange(e.target.value.split(/\r?\n/).filter((l) => l.trim() !== ""))} rows={Math.min(12, Math.max(3, value.length + 1))} />
        </div>
      );
    }
    const sample = value[0] ?? { title: "", description: "" };
    return (
      <fieldset className={cn("rounded-xl border p-3", depth > 0 && "bg-muted/20")}>
        <legend className="px-1 text-sm font-semibold">
          {label} <span className="font-normal text-muted-foreground">({value.length})</span>
        </legend>
        <div className="space-y-3">
          {value.map((item, index) => (
            <div key={index} className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {labelFor(keyName).replace(/s$/, "")} {index + 1}
                </span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => onChange(value.map((v, i, arr) => (i === index - 1 ? arr[index]! : i === index ? arr[index - 1]! : v)))}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === value.length - 1} onClick={() => onChange(value.map((v, i, arr) => (i === index + 1 ? arr[index]! : i === index ? arr[index + 1]! : v)))}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
              <ValueEditor id={`${id}-${index}`} keyName={keyName} value={item} onChange={(v) => onChange(value.map((x, i) => (i === index ? v : x)))} depth={depth + 1} />
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, templateFrom(sample)])}>
            <Plus /> Add {labelFor(keyName).toLowerCase().replace(/s$/, "")}
          </Button>
        </div>
      </fieldset>
    );
  }
  // Plain object
  const entries = Object.entries(value);
  const content = (
    <div className="grid gap-3">
      {entries.map(([k, v]) => (
        <ValueEditor key={k} id={`${id}-${k}`} keyName={k} value={v} onChange={(nv) => onChange({ ...value, [k]: nv })} depth={depth + 1} />
      ))}
    </div>
  );
  if (depth === 0) return content;
  return (
    <fieldset className="rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {content}
    </fieldset>
  );
}

/**
 * Generates a form from the shape of a JSON value: strings, numbers, booleans,
 * lists of strings and repeatable groups of objects. The current value is
 * submitted as JSON in a hidden `value` field.
 */
export function StructuredEditor({ initial, name = "value", idPrefix = "field" }: { initial: JsonValue; name?: string; idPrefix?: string }) {
  const [value, setValue] = React.useState<JsonValue>(initial);
  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      <ValueEditor id={idPrefix} keyName="" value={value} onChange={setValue} depth={0} />
    </div>
  );
}
