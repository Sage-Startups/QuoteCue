"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Search, Trash2, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, Field } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calculateQuote } from "@/lib/quotes/pricing";
import { formatMoney, parseMoneyToMinor } from "@/lib/utils/money";
import { UNIT_LABELS } from "@/lib/quotes/units";
import { cn } from "@/lib/utils/cn";
import { searchCatalogueAction } from "@/app/app/catalogue/actions";
import { savePricingAction } from "@/app/app/quotes/[id]/edit/actions";
import type { WizardData, WizardLineItem, WizardPricing } from "./types";

type CatalogueHit = Awaited<ReturnType<typeof searchCatalogueAction>>[number];

function newClientId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function MoneyInput({ id, valueMinor, onChange, currency, className, label }: { id: string; valueMinor: number; onChange: (minor: number) => void; currency: WizardData["quote"]["currency"]; className?: string; label?: string }) {
  const [text, setText] = useState((valueMinor / 100).toFixed(2));
  const [lastValue, setLastValue] = useState(valueMinor);
  function parseSafe(v: string) {
    try {
      return parseMoneyToMinor(v, currency);
    } catch {
      return NaN;
    }
  }
  // Re-sync the text when the value changes externally (derived state pattern, no effect needed).
  if (lastValue !== valueMinor) {
    setLastValue(valueMinor);
    if (parseSafe(text) !== valueMinor) setText((valueMinor / 100).toFixed(2));
  }
  return (
    <Input
      id={id}
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const minor = parseSafe(e.target.value);
        if (Number.isFinite(minor) && minor >= 0) onChange(minor);
      }}
      onBlur={() => setText((valueMinor / 100).toFixed(2))}
      className={cn("h-9 text-right tabular", className)}
    />
  );
}

function SortableRow({ item, index, currency, onChange, onRemove, onDuplicate, showCost }: { item: WizardLineItem; index: number; currency: WizardData["quote"]["currency"]; onChange: (patch: Partial<WizardLineItem>) => void; onRemove: () => void; onDuplicate: () => void; showCost: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.clientId });
  const [expanded, setExpanded] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const qty = Number(item.quantity) || 0;
  const lineTotal = Math.round(qty * item.unitPriceMinor);
  const unpriced = item.unitPriceMinor === 0;
  return (
    <li ref={setNodeRef} style={style} className={cn("rounded-lg border bg-white p-3 shadow-card", isDragging && "opacity-70 ring-2 ring-primary", unpriced && "border-amber-400")}>
      <div className="flex items-start gap-2">
        <button type="button" className="mt-2 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Reorder item ${index + 1}`} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <div className="grid flex-1 gap-2 md:grid-cols-12">
          <div className="md:col-span-5">
            <label htmlFor={`desc-${item.clientId}`} className="sr-only">
              Description
            </label>
            <Input id={`desc-${item.clientId}`} value={item.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Description" className="h-9" />
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {item.aiSuggested ? <Badge variant="muted">AI suggested</Badge> : null}
              {unpriced ? <Badge variant="warning">Needs a price</Badge> : null}
              {item.isOptional ? <Badge variant="outline">Optional</Badge> : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:col-span-7 md:grid-cols-7">
            <div className="md:col-span-1">
              <label htmlFor={`qty-${item.clientId}`} className="text-[11px] font-medium text-muted-foreground md:sr-only">
                Qty
              </label>
              <Input id={`qty-${item.clientId}`} inputMode="decimal" value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} className="h-9 text-right tabular" aria-label="Quantity" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor={`unit-${item.clientId}`} className="text-[11px] font-medium text-muted-foreground md:sr-only">
                Unit
              </label>
              <Select id={`unit-${item.clientId}`} value={item.unit} onChange={(e) => onChange({ unit: e.target.value as WizardLineItem["unit"] })} className="h-9 md:h-9" aria-label="Unit">
                {Object.entries(UNIT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor={`price-${item.clientId}`} className="text-[11px] font-medium text-muted-foreground md:sr-only">
                Unit price
              </label>
              <MoneyInput id={`price-${item.clientId}`} valueMinor={item.unitPriceMinor} onChange={(m) => onChange({ unitPriceMinor: m })} currency={currency} label="Unit price" />
            </div>
            <div className="col-span-3 flex items-center justify-between md:col-span-2 md:justify-end">
              <span className="text-[11px] font-medium text-muted-foreground md:hidden">Line total</span>
              <span className="text-sm font-semibold tabular">{formatMoney(lineTotal, currency)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label="More options">
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove item">
            <Trash2 />
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-4">
          <Field label="Type" htmlFor={`kind-${item.clientId}`}>
            <Select id={`kind-${item.clientId}`} value={item.kind} onChange={(e) => onChange({ kind: e.target.value as WizardLineItem["kind"] })} className="h-9 md:h-9">
              <option value="LABOUR">Labour</option>
              <option value="MATERIAL">Material</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Line discount" htmlFor={`disc-${item.clientId}`}>
            <div className="flex gap-1">
              <Select value={item.discountType} onChange={(e) => onChange({ discountType: e.target.value as WizardLineItem["discountType"], discountValue: 0 })} className="h-9 md:h-9" aria-label="Discount type">
                <option value="NONE">None</option>
                <option value="PERCENT">%</option>
                <option value="FIXED">Fixed</option>
              </Select>
              {item.discountType === "PERCENT" ? (
                <Input id={`disc-${item.clientId}`} inputMode="decimal" value={(item.discountValue / 100).toString()} onChange={(e) => onChange({ discountValue: Math.round(Number(e.target.value || 0) * 100) })} className="h-9 w-20 text-right" aria-label="Discount percent" />
              ) : item.discountType === "FIXED" ? (
                <MoneyInput id={`disc-${item.clientId}`} valueMinor={item.discountValue} onChange={(m) => onChange({ discountValue: m })} currency={currency} className="w-24" label="Discount amount" />
              ) : null}
            </div>
          </Field>
          <Field label="Tax" htmlFor={`tax-${item.clientId}`}>
            <Select id={`tax-${item.clientId}`} value={item.taxTreatment} onChange={(e) => onChange({ taxTreatment: e.target.value as WizardLineItem["taxTreatment"] })} className="h-9 md:h-9">
              <option value="TAXABLE">Taxable</option>
              <option value="EXEMPT">Exempt</option>
            </Select>
          </Field>
          {showCost ? (
            <Field label="Internal cost (per unit)" htmlFor={`cost-${item.clientId}`} hint="Never shown to customers.">
              <MoneyInput id={`cost-${item.clientId}`} valueMinor={item.internalCostMinor} onChange={(m) => onChange({ internalCostMinor: m })} currency={currency} label="Internal cost" />
            </Field>
          ) : null}
          <Field label="Customer-facing description" htmlFor={`cdesc-${item.clientId}`} className="md:col-span-3">
            <Textarea id={`cdesc-${item.clientId}`} value={item.customerDescription} onChange={(e) => onChange({ customerDescription: e.target.value })} rows={2} />
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isOptional} onChange={(e) => onChange({ isOptional: e.target.checked })} className="size-4 accent-primary" /> Optional extra
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy /> Duplicate
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function StepPricing({ data }: { data: WizardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<WizardLineItem[]>(data.items);
  const [pricing, setPricing] = useState<WizardPricing>(data.pricing);
  const [groupByKind, setGroupByKind] = useState(false);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<CatalogueHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const currency = data.quote.currency;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    if (!searchOpen) return;
    const handle = setTimeout(async () => {
      try {
        setHits(await searchCatalogueAction(search));
      } catch {
        setHits([]);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [search, searchOpen]);

  const totals = useMemo(() => {
    try {
      return calculateQuote({
        lines: items.map((i) => ({ quantity: i.quantity || "0", unitPriceMinor: i.unitPriceMinor, discountType: i.discountType, discountValue: i.discountValue, taxTreatment: i.taxTreatment, internalCostMinor: i.internalCostMinor, isOptional: i.isOptional })),
        pricingMode: pricing.pricingMode,
        taxRateBps: pricing.pricingMode === "NO_TAX" ? 0 : pricing.taxRateBps,
        discountType: pricing.discountType,
        discountValue: pricing.discountValue,
        callOutFeeMinor: pricing.callOutFeeMinor,
      });
    } catch {
      return null;
    }
  }, [items, pricing]);

  const update = (clientId: string, patch: Partial<WizardLineItem>) => setItems((list) => list.map((i) => (i.clientId === clientId ? { ...i, ...patch } : i)));
  const addFromCatalogue = (c: CatalogueHit) => {
    setItems((list) => [...list, { id: "", clientId: newClientId(), description: c.name, customerDescription: c.customerDescription ?? "", quantity: "1", unit: c.unit, kind: c.kind, unitPriceMinor: c.unitPriceMinor, discountType: "NONE", discountValue: 0, taxTreatment: c.taxTreatment, internalCostMinor: c.internalCostMinor, catalogueItemId: c.id, isOptional: false, aiSuggested: false }]);
    setSearchOpen(false);
    setSearch("");
  };
  const addCustom = (kind: WizardLineItem["kind"]) =>
    setItems((list) => [...list, { id: "", clientId: newClientId(), description: "", customerDescription: "", quantity: "1", unit: kind === "LABOUR" ? "HOUR" : "ITEM", kind, unitPriceMinor: kind === "LABOUR" ? data.settings.labourRateMinor : 0, discountType: "NONE", discountValue: 0, taxTreatment: "TAXABLE", internalCostMinor: 0, catalogueItemId: null, isOptional: false, aiSuggested: false }]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((list) => {
      const from = list.findIndex((i) => i.clientId === active.id);
      const to = list.findIndex((i) => i.clientId === over.id);
      return arrayMove(list, from, to);
    });
  };

  const save = (nextStep: number) =>
    start(async () => {
      if (items.some((i) => !i.description.trim())) {
        toast.error("Every line item needs a description.");
        return;
      }
      const result = await savePricingAction(data.quote.id, items, pricing);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      router.push(`/app/quotes/${data.quote.id}/edit?step=${nextStep}`);
      router.refresh();
    });

  const unpricedCount = items.filter((i) => i.unitPriceMinor === 0 && !i.isOptional).length;
  const ordered = groupByKind ? [...items].sort((a, b) => ["LABOUR", "MATERIAL", "OTHER"].indexOf(a.kind) - ["LABOUR", "MATERIAL", "OTHER"].indexOf(b.kind)) : items;

  return (
    <div className="space-y-6">
      {data.quote.isLocked ? <Alert variant="warning">This version is locked because it was accepted. Create a revision from the quote page to change pricing.</Alert> : null}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Line items</CardTitle>
              <CardDescription>Drag to reorder. Totals are calculated deterministically on the server when you save.</CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={groupByKind} onChange={(e) => setGroupByKind(e.target.checked)} className="size-4 accent-primary" /> Group labour and materials
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {unpricedCount > 0 ? <Alert variant="warning">{unpricedCount} item{unpricedCount === 1 ? " needs" : "s need"} a price before sending. AI never invents prices.</Alert> : null}
          {items.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No line items yet. Add from your catalogue or create a custom item.</p> : null}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ordered.map((i) => i.clientId)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {ordered.map((item, idx) => (
                  <SortableRow
                    key={item.clientId}
                    item={item}
                    index={idx}
                    currency={currency}
                    showCost
                    onChange={(patch) => update(item.clientId, patch)}
                    onRemove={() => setItems((list) => list.filter((i) => i.clientId !== item.clientId))}
                    onDuplicate={() => setItems((list) => [...list, { ...item, id: "", clientId: newClientId() }])}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <div className="flex flex-wrap gap-2">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary">
                  <Search /> Add from catalogue
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-2">
                <label htmlFor="cat-search" className="sr-only">
                  Search catalogue
                </label>
                <Input id="cat-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services…" autoFocus className="h-9" />
                <ul className="mt-2 max-h-64 divide-y overflow-y-auto" role="listbox">
                  {hits.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => addFromCatalogue(c)} className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {c.category} · per {UNIT_LABELS[c.unit].toLowerCase()}
                          </span>
                        </span>
                        <span className="shrink-0 tabular">{formatMoney(c.unitPriceMinor, currency)}</span>
                      </button>
                    </li>
                  ))}
                  {hits.length === 0 ? <li className="px-2 py-3 text-sm text-muted-foreground">No matching services.</li> : null}
                </ul>
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={() => addCustom("LABOUR")}>
              <Plus /> Custom labour
            </Button>
            <Button variant="outline" onClick={() => addCustom("MATERIAL")}>
              <Plus /> Custom material
            </Button>
            <Button variant="outline" onClick={() => addCustom("OTHER")}>
              <Plus /> Other item
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pricing settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax handling" htmlFor="pricingMode">
              <Select id="pricingMode" value={pricing.pricingMode} onChange={(e) => setPricing({ ...pricing, pricingMode: e.target.value as WizardPricing["pricingMode"] })}>
                <option value="TAX_EXCLUSIVE">Prices exclude tax (added on top)</option>
                <option value="TAX_INCLUSIVE">Prices include tax</option>
                <option value="NO_TAX">No tax</option>
              </Select>
            </Field>
            {pricing.pricingMode !== "NO_TAX" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tax label" htmlFor="taxLabel">
                  <Input id="taxLabel" value={pricing.taxLabel} onChange={(e) => setPricing({ ...pricing, taxLabel: e.target.value })} />
                </Field>
                <Field label="Tax rate %" htmlFor="taxRate">
                  <Input id="taxRate" inputMode="decimal" value={(pricing.taxRateBps / 100).toString()} onChange={(e) => setPricing({ ...pricing, taxRateBps: Math.round(Number(e.target.value || 0) * 100) })} />
                </Field>
              </div>
            ) : null}
            <Field label="Quote discount" htmlFor="discountValue">
              <div className="flex gap-1">
                <Select value={pricing.discountType} onChange={(e) => setPricing({ ...pricing, discountType: e.target.value as WizardPricing["discountType"], discountValue: 0 })} aria-label="Discount type">
                  <option value="NONE">None</option>
                  <option value="PERCENT">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </Select>
                {pricing.discountType === "PERCENT" ? (
                  <Input id="discountValue" inputMode="decimal" value={(pricing.discountValue / 100).toString()} onChange={(e) => setPricing({ ...pricing, discountValue: Math.round(Number(e.target.value || 0) * 100) })} className="w-24 text-right" aria-label="Discount percent" />
                ) : pricing.discountType === "FIXED" ? (
                  <MoneyInput id="discountValue" valueMinor={pricing.discountValue} onChange={(m) => setPricing({ ...pricing, discountValue: m })} currency={currency} className="w-28 h-11 md:h-10" label="Discount amount" />
                ) : null}
              </div>
            </Field>
            <Field label="Call-out fee" htmlFor="callOut">
              <div className="flex gap-1">
                <Input value={pricing.callOutFeeLabel} onChange={(e) => setPricing({ ...pricing, callOutFeeLabel: e.target.value })} aria-label="Call-out fee label" />
                <MoneyInput id="callOut" valueMinor={pricing.callOutFeeMinor} onChange={(m) => setPricing({ ...pricing, callOutFeeMinor: m })} currency={currency} className="w-28 h-11 md:h-10" label="Call-out fee amount" />
              </div>
            </Field>
            <Field label="Deposit terms" htmlFor="depositTerms" hint="Shown to the customer as text. Deposits are not collected through QuoteCue." className="sm:col-span-2">
              <Textarea id="depositTerms" value={pricing.depositTerms} onChange={(e) => setPricing({ ...pricing, depositTerms: e.target.value })} rows={2} />
            </Field>
            <Field label="Internal notes" htmlFor="internalNotes" hint="Never shown to the customer." className="sm:col-span-2">
              <Textarea id="internalNotes" value={pricing.internalNotes} onChange={(e) => setPricing({ ...pricing, internalNotes: e.target.value })} rows={2} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
            <CardDescription>Live preview; the server recalculates on save.</CardDescription>
          </CardHeader>
          <CardContent>
            {totals ? (
              <dl className="space-y-1.5 text-sm">
                <Row label="Items" value={formatMoney(totals.subtotalMinor - totals.callOutFeeMinor, currency)} />
                {totals.callOutFeeMinor > 0 ? <Row label={pricing.callOutFeeLabel || "Call-out fee"} value={formatMoney(totals.callOutFeeMinor, currency)} /> : null}
                <Row label="Subtotal" value={formatMoney(totals.subtotalMinor, currency)} />
                {totals.discountMinor > 0 ? <Row label="Discount" value={`-${formatMoney(totals.discountMinor, currency)}`} /> : null}
                {pricing.pricingMode !== "NO_TAX" ? <Row label={`${pricing.pricingMode === "TAX_INCLUSIVE" ? "Of which " : ""}${pricing.taxLabel} (${pricing.taxRateBps / 100}%)`} value={formatMoney(totals.taxMinor, currency)} /> : null}
                <div className="flex justify-between border-t-2 border-foreground pt-2 text-base font-bold">
                  <dt>Total</dt>
                  <dd className="tabular">{formatMoney(totals.totalMinor, currency)}</dd>
                </div>
                <div className="mt-3 rounded-lg bg-muted p-3 text-xs">
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">Internal (not shown to customer)</p>
                  <Row label="Cost" value={formatMoney(totals.internalCostMinor, currency)} />
                  <Row label="Margin" value={`${formatMoney(totals.marginMinor, currency)} (${totals.marginPercent}%)`} />
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white">
                    <div className={cn("h-full rounded-full", totals.marginPercent < 15 ? "bg-destructive" : totals.marginPercent < 30 ? "bg-amber-500" : "bg-success")} style={{ width: `${Math.max(0, Math.min(100, totals.marginPercent))}%` }} />
                  </div>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-destructive">Check quantities: one of them is not a valid number.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => router.push(`/app/quotes/${data.quote.id}/edit?step=${data.analysis ? 3 : 2}`)}>
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => save(4)} loading={pending} disabled={data.quote.isLocked}>
            Save
          </Button>
          <Button size="lg" onClick={() => save(5)} loading={pending} disabled={data.quote.isLocked || items.length === 0}>
            Save and write the quote
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
