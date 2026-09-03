"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createTradeTemplateAction, updateTradeTemplateAction } from "./actions";
import { KINDS, UNITS, type ServiceRow } from "./schema";

export interface TradeTemplateFormValues {
  slug: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  defaultScope: string;
  defaultTerms: string;
  commonExclusions: string;
  commonQuestions: string;
  defaultAssumptions: string;
  suggestedServices: ServiceRow[];
}

const UNIT_LABELS: Record<(typeof UNITS)[number], string> = { HOUR: "Hour", DAY: "Day", ITEM: "Item", METRE: "Metre", SQUARE_METRE: "Square metre", VISIT: "Visit", FIXED: "Fixed" };

function TextField({ id, name, label, defaultValue, hint, required, type = "text", placeholder }: { id: string; name: string; label: string; defaultValue: string | number; hint?: string; required?: boolean; type?: string; placeholder?: string }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <Input id={id} name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} />
    </Field>
  );
}

function AreaField({ id, name, label, defaultValue, hint, rows = 4 }: { id: string; name: string; label: string; defaultValue: string; hint?: string; rows?: number }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Textarea id={id} name={name} defaultValue={defaultValue} rows={rows} />
    </Field>
  );
}

const EMPTY_ROW: ServiceRow = { name: "", category: "General", unit: "ITEM", kind: "LABOUR", unitPrice: "", internalCost: "", customerDescription: "" };

function ServicesTable({ initial }: { initial: ServiceRow[] }) {
  const [rows, setRows] = React.useState<ServiceRow[]>(initial);
  const error = useFieldError("suggestedServices");
  const update = (index: number, patch: Partial<ServiceRow>) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <input type="hidden" name="suggestedServices" value={JSON.stringify(rows)} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Suggested services <span className="font-normal text-muted-foreground">({rows.length})</span>
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}>
          <Plus /> Add service
        </Button>
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[12rem]">Name</TableHead>
            <TableHead className="min-w-[8rem]">Category</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead className="min-w-[6rem]">Price</TableHead>
            <TableHead className="min-w-[6rem]">Cost</TableHead>
            <TableHead className="min-w-[14rem]">Customer description</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                No services yet.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell>
                <Input aria-label={`Service ${i + 1} name`} value={row.name} onChange={(e) => update(i, { name: e.target.value })} className="h-9 text-sm" />
              </TableCell>
              <TableCell>
                <Input aria-label={`Service ${i + 1} category`} value={row.category} onChange={(e) => update(i, { category: e.target.value })} className="h-9 text-sm" />
              </TableCell>
              <TableCell>
                <Select aria-label={`Service ${i + 1} unit`} value={row.unit} onChange={(e) => update(i, { unit: e.target.value as ServiceRow["unit"] })} className="h-9 text-sm">
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u]}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <Select aria-label={`Service ${i + 1} kind`} value={row.kind} onChange={(e) => update(i, { kind: e.target.value as ServiceRow["kind"] })} className="h-9 text-sm">
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k.charAt(0) + k.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <Input aria-label={`Service ${i + 1} unit price`} value={row.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} inputMode="decimal" placeholder="0.00" className="h-9 text-sm" />
              </TableCell>
              <TableCell>
                <Input aria-label={`Service ${i + 1} internal cost`} value={row.internalCost} onChange={(e) => update(i, { internalCost: e.target.value })} inputMode="decimal" placeholder="0.00" className="h-9 text-sm" />
              </TableCell>
              <TableCell>
                <Input aria-label={`Service ${i + 1} customer description`} value={row.customerDescription} onChange={(e) => update(i, { customerDescription: e.target.value })} className="h-9 text-sm" />
              </TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove service ${i + 1}`} onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TradeTemplateForm({ values, mode }: { values: TradeTemplateFormValues; mode: "create" | "edit" }) {
  const router = useRouter();
  const slugError = useFieldError("slug");
  const body = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="tt-name" name="name" label="Name" defaultValue={values.name} required />
        {mode === "create" ? (
          <Field label="Slug" htmlFor="tt-slug" required error={slugError} hint="Lowercase letters, numbers and dashes. Cannot be changed later.">
            <Input id="tt-slug" name="slug" defaultValue={values.slug} required pattern="^[a-z0-9-]+$" placeholder="e.g. tiler" />
          </Field>
        ) : (
          <Field label="Slug" htmlFor="tt-slug" hint="Slugs cannot be changed after creation.">
            <Input id="tt-slug" defaultValue={values.slug} readOnly />
          </Field>
        )}
      </div>
      <TextField id="tt-description" name="description" label="Description" defaultValue={values.description} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField id="tt-icon" name="icon" label="Icon" defaultValue={values.icon} hint="Lucide icon name, e.g. zap, droplets, hammer." />
        <TextField id="tt-sort" name="sortOrder" label="Sort order" type="number" defaultValue={values.sortOrder} />
        <label htmlFor="tt-active" className="inline-flex items-center gap-2 self-end pb-2.5 text-sm">
          <input id="tt-active" name="isActive" type="checkbox" defaultChecked={values.isActive} className="size-4 rounded border-input accent-primary" />
          Active (offered during onboarding)
        </label>
      </div>
      <AreaField id="tt-scope" name="defaultScope" label="Default scope wording" defaultValue={values.defaultScope} />
      <AreaField id="tt-terms" name="defaultTerms" label="Default terms" defaultValue={values.defaultTerms} />
      <div className="grid gap-3 lg:grid-cols-3">
        <AreaField id="tt-exclusions" name="commonExclusions" label="Common exclusions" defaultValue={values.commonExclusions} hint="One per line." rows={5} />
        <AreaField id="tt-questions" name="commonQuestions" label="Common questions" defaultValue={values.commonQuestions} hint="One per line." rows={5} />
        <AreaField id="tt-assumptions" name="defaultAssumptions" label="Default assumptions" defaultValue={values.defaultAssumptions} hint="One per line." rows={5} />
      </div>
      <ServicesTable initial={values.suggestedServices} />
    </>
  );
  if (mode === "create") {
    return (
      <ActionForm action={createTradeTemplateAction} submitLabel="Create template" className="space-y-4" onSuccess={(data) => router.push(`/super-admin/trade-templates/${data.slug}`)}>
        {body}
      </ActionForm>
    );
  }
  return (
    <ActionForm action={updateTradeTemplateAction} hidden={{ slug: values.slug }} submitLabel="Save template" className="space-y-4">
      {body}
    </ActionForm>
  );
}
