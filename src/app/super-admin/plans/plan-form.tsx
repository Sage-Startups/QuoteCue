"use client";

import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { Field } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { savePlanAction } from "./actions";

export interface PlanFormPlan {
  id: string;
  key: string;
  kind: "SUBSCRIPTION" | "CREDIT_PACK";
  name: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  oneTimePrice: string;
  aiGenerationsPerPeriod: number;
  creditsGranted: number;
  maxMembers: number;
  storageAllowanceMb: number;
  featureBullets: string;
  stripeMonthlyPriceId: string;
  stripeAnnualPriceId: string;
  stripeOneTimePriceId: string;
  isActive: boolean;
  isPublic: boolean;
  highlight: boolean;
  sortOrder: number;
  entitlements: string[];
}

function TextField({ id, name, label, defaultValue, type = "text", hint, required, placeholder, step, min }: { id: string; name: string; label: string; defaultValue: string | number; type?: string; hint?: string; required?: boolean; placeholder?: string; step?: string; min?: number }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <Input id={id} name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} step={step} min={min} inputMode={type === "number" ? "numeric" : undefined} />
    </Field>
  );
}

function CheckField({ id, name, label, defaultChecked }: { id: string; name: string; label: string; defaultChecked: boolean }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 rounded border-input accent-primary" />
      {label}
    </label>
  );
}

export function PlanForm({ plan, entitlementKeys, stripeConfigured }: { plan: PlanFormPlan; entitlementKeys: Array<{ key: string; label: string }>; stripeConfigured: boolean }) {
  const p = plan.id.slice(0, 8);
  const descriptionError = useFieldError("description");
  const isPack = plan.kind === "CREDIT_PACK";
  return (
    <ActionForm action={savePlanAction} hidden={{ planId: plan.id }} submitLabel="Save plan" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id={`${p}-name`} name="name" label="Name" defaultValue={plan.name} required />
        <TextField id={`${p}-sort`} name="sortOrder" label="Sort order" type="number" defaultValue={plan.sortOrder} min={0} />
      </div>
      <Field label="Description" htmlFor={`${p}-description`} error={descriptionError}>
        <Textarea id={`${p}-description`} name="description" rows={2} defaultValue={plan.description} maxLength={400} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        {isPack ? (
          <TextField id={`${p}-onetime`} name="oneTimePrice" label="One-time price (USD)" defaultValue={plan.oneTimePrice} placeholder="9.00" hint="Decimal; stored in minor units." />
        ) : (
          <>
            <TextField id={`${p}-monthly`} name="monthlyPrice" label="Monthly price (USD)" defaultValue={plan.monthlyPrice} placeholder="19.00" />
            <TextField id={`${p}-annual`} name="annualPrice" label="Annual price (USD)" defaultValue={plan.annualPrice} placeholder="190.00" />
          </>
        )}
        <TextField id={`${p}-credits`} name="creditsGranted" label="Credits granted" type="number" defaultValue={plan.creditsGranted} min={0} hint={isPack ? "Credits added per purchase." : "One-off credits for new workspaces."} />
      </div>
      {!isPack ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField id={`${p}-gens`} name="aiGenerationsPerPeriod" label="AI generations per period" type="number" defaultValue={plan.aiGenerationsPerPeriod} min={0} />
          <TextField id={`${p}-members`} name="maxMembers" label="Max members" type="number" defaultValue={plan.maxMembers} min={0} />
          <TextField id={`${p}-storage`} name="storageAllowanceMb" label="Storage allowance (MB)" type="number" defaultValue={plan.storageAllowanceMb} min={0} />
        </div>
      ) : (
        <>
          <input type="hidden" name="aiGenerationsPerPeriod" value={plan.aiGenerationsPerPeriod} />
          <input type="hidden" name="maxMembers" value={plan.maxMembers} />
          <input type="hidden" name="storageAllowanceMb" value={plan.storageAllowanceMb} />
        </>
      )}
      <Field label="Feature bullets" htmlFor={`${p}-bullets`} hint="One per line. Shown on the pricing page and billing screen.">
        <Textarea id={`${p}-bullets`} name="featureBullets" rows={5} defaultValue={plan.featureBullets} />
      </Field>
      {!isPack ? (
        <fieldset>
          <legend className="text-sm font-medium">Entitlements</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {entitlementKeys.map((e) => (
              <label key={e.key} htmlFor={`${p}-ent-${e.key}`} className="inline-flex items-center gap-2 text-sm">
                <input id={`${p}-ent-${e.key}`} name="entitlements" value={e.key} type="checkbox" defaultChecked={plan.entitlements.includes(e.key)} className="size-4 rounded border-input accent-primary" />
                {e.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <fieldset>
        <legend className="text-sm font-medium">Stripe price ids</legend>
        <p className="mb-2 text-xs text-muted-foreground">{stripeConfigured ? "Ids are verified against Stripe when saved." : "Stripe is not configured, so ids are only checked for format."} Blank falls back to the environment variables.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {isPack ? (
            <TextField id={`${p}-price-onetime`} name="stripeOneTimePriceId" label="One-time price id" defaultValue={plan.stripeOneTimePriceId} placeholder="price_…" />
          ) : (
            <>
              <TextField id={`${p}-price-monthly`} name="stripeMonthlyPriceId" label="Monthly price id" defaultValue={plan.stripeMonthlyPriceId} placeholder="price_…" />
              <TextField id={`${p}-price-annual`} name="stripeAnnualPriceId" label="Annual price id" defaultValue={plan.stripeAnnualPriceId} placeholder="price_…" />
            </>
          )}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <CheckField id={`${p}-active`} name="isActive" label="Active (can be purchased)" defaultChecked={plan.isActive} />
        <CheckField id={`${p}-public`} name="isPublic" label="Public (shown on pricing page)" defaultChecked={plan.isPublic} />
        <CheckField id={`${p}-highlight`} name="highlight" label="Highlight as recommended" defaultChecked={plan.highlight} />
      </div>
    </ActionForm>
  );
}
