"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { importCatalogueAction } from "@/app/app/catalogue/actions";

export function ImportCatalogueDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(importCatalogueAction, null);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload /> Import CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import services from CSV</DialogTitle>
            <DialogDescription>
              Columns: name, category, description, customer_description, unit (hour, day, item, metre, square metre, visit, fixed), kind (labour, material, other), unit_price, internal_cost, tax_treatment (taxable or exempt), active (yes/no). Items with a matching name are updated. Export your catalogue first to get a template.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
            {state?.ok ? (
              <Alert variant={state.data.errors.length > 0 ? "warning" : "success"} title={state.message}>
                {state.data.errors.length > 0 ? (
                  <ul className="mt-1 list-disc pl-4 text-xs">
                    {state.data.errors.slice(0, 8).map((e) => (
                      <li key={e.row}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}
            <div>
              <label htmlFor="csv-file" className="text-sm font-medium">
                CSV file
              </label>
              <input id="csv-file" name="file" type="file" accept=".csv,text/csv" required className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="submit" loading={pending}>
                Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
