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
import { Select } from "@/components/ui/select";
import { Field, Alert } from "@/components/ui/misc";
import { UNIT_LABELS } from "@/lib/quotes/units";
import { saveCatalogueItemAction } from "@/app/app/catalogue/actions";

export interface CatalogueItemValues {
  id?: string;
  name: string;
  category: string;
  description: string;
  customerDescription: string;
  unit: string;
  kind: string;
  unitPrice: string;
  internalCost: string;
  taxTreatment: string;
  isActive: boolean;
}

export function CatalogueItemDialog({ initial, categories, currency, trigger }: { initial?: CatalogueItemValues; categories: string[]; currency: string; trigger?: "button" | "icon" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult<{ id: string }> | null, fd: FormData) => {
    const result = await saveCatalogueItemAction(prev, fd);
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
      {trigger === "icon" ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Edit ${initial?.name ?? "item"}`}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> Add service
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{initial?.id ? "Edit service" : "Add service"}</DialogTitle>
            <DialogDescription>Prices are in {currency}. Internal cost and margin are never shown to customers.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4" noValidate>
            {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
            {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
            <Field label="Service name" htmlFor="ci-name" required error={err("name")}>
              <Input id="ci-name" name="name" defaultValue={initial?.name} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="ci-category" required error={err("category")}>
                <Input id="ci-category" name="category" defaultValue={initial?.category ?? "General"} list="ci-categories" />
                <datalist id="ci-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Type" htmlFor="ci-kind" required>
                <Select id="ci-kind" name="kind" defaultValue={initial?.kind ?? "LABOUR"}>
                  <option value="LABOUR">Labour</option>
                  <option value="MATERIAL">Material</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Unit" htmlFor="ci-unit" required>
                <Select id="ci-unit" name="unit" defaultValue={initial?.unit ?? "ITEM"}>
                  {Object.entries(UNIT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tax treatment" htmlFor="ci-tax" required>
                <Select id="ci-tax" name="taxTreatment" defaultValue={initial?.taxTreatment ?? "TAXABLE"}>
                  <option value="TAXABLE">Taxable</option>
                  <option value="EXEMPT">Exempt</option>
                </Select>
              </Field>
              <Field label={`Selling price (${currency})`} htmlFor="ci-price" required error={err("unitPrice")}>
                <Input id="ci-price" name="unitPrice" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={initial?.unitPrice ?? "0"} required />
              </Field>
              <Field label={`Internal cost (${currency})`} htmlFor="ci-cost" error={err("internalCost")} hint="Used for margin indicators.">
                <Input id="ci-cost" name="internalCost" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={initial?.internalCost ?? "0"} />
              </Field>
            </div>
            <Field label="Internal description" htmlFor="ci-description" error={err("description")}>
              <Textarea id="ci-description" name="description" defaultValue={initial?.description} rows={2} />
            </Field>
            <Field label="Customer-facing description" htmlFor="ci-customer" error={err("customerDescription")} hint="Shown under the line item on quotes.">
              <Textarea id="ci-customer" name="customerDescription" defaultValue={initial?.customerDescription} rows={2} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="size-4 accent-primary" /> Active (available when building quotes)
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {initial?.id ? "Save" : "Add service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
