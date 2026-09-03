"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, Alert } from "@/components/ui/misc";
import { LogoUpload } from "@/components/uploads/logo-upload";
import { cn } from "@/lib/utils/cn";
import type { ActionResult } from "@/lib/utils/result";
import { completeOnboardingAction } from "@/app/onboarding/actions";

interface Props {
  defaultName: string;
  defaultEmail: string;
  trades: Array<{ slug: string; name: string; description: string }>;
  currencies: string[];
  defaultCurrency: string;
  defaultValidityDays: number;
  defaultTerms: string;
  maxLogoMb: number;
}

const STEPS = [
  { key: "you", title: "About you", description: "Your name and business." },
  { key: "business", title: "Business details", description: "Address and contact details for your quotes." },
  { key: "money", title: "Currency and tax", description: "How you price and charge tax." },
  { key: "rates", title: "Rates and terms", description: "Defaults used when building quotes." },
  { key: "brand", title: "Branding", description: "Logo and colour for your quote documents." },
  { key: "finish", title: "Finish", description: "Starter catalogue and sample quote." },
];

const TAX_PRESETS: Record<string, { label: string; rate: number; taxLabel: string }> = {
  NONE: { label: "No tax", rate: 0, taxLabel: "" },
  VAT: { label: "VAT", rate: 20, taxLabel: "VAT" },
  GST: { label: "GST", rate: 10, taxLabel: "GST" },
  SALES_TAX: { label: "Sales tax", rate: 8, taxLabel: "Sales tax" },
  CUSTOM: { label: "Custom tax", rate: 0, taxLabel: "Tax" },
};

const CURRENCY_DEFAULTS: Record<string, { taxMode: string; country: string }> = {
  GBP: { taxMode: "VAT", country: "GB" },
  EUR: { taxMode: "VAT", country: "IE" },
  USD: { taxMode: "SALES_TAX", country: "US" },
  CAD: { taxMode: "GST", country: "CA" },
  AUD: { taxMode: "GST", country: "AU" },
  NZD: { taxMode: "GST", country: "NZ" },
};

export function OnboardingForm(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState(async (prev: ActionResult<{ redirectTo: string }> | null, fd: FormData) => {
    const result = await completeOnboardingAction(prev, fd);
    if (!result.ok && result.fieldErrors) {
      const fields = Object.keys(result.fieldErrors);
      const stepFields: string[][] = [["fullName", "businessName", "tradeSlug"], ["addressLine1", "city", "postalCode", "country", "phone", "email", "website"], ["currency", "taxMode", "taxLabel", "taxRatePercent", "pricingMode"], ["labourRate", "callOutFee", "paymentTerms", "quoteValidityDays"], ["brandColor", "logoObjectId"], []];
      const target = stepFields.findIndex((fs) => fs.some((f) => fields.includes(f)));
      if (target >= 0) setStep(target);
    }
    return result;
  }, null);
  const [currency, setCurrency] = useState(props.defaultCurrency);
  const [taxMode, setTaxMode] = useState(CURRENCY_DEFAULTS[props.defaultCurrency]?.taxMode ?? "VAT");
  const [taxRate, setTaxRate] = useState(String(TAX_PRESETS[CURRENCY_DEFAULTS[props.defaultCurrency]?.taxMode ?? "VAT"]?.rate ?? 20));
  const [country, setCountry] = useState(CURRENCY_DEFAULTS[props.defaultCurrency]?.country ?? "GB");
  const [brandColor, setBrandColor] = useState("#0f1f3d");
  const [labourUnit, setLabourUnit] = useState("HOUR");
  const err = (field: string) => (state && !state.ok ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state?.ok) {
      router.push(state.data.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  const progress = useMemo(() => Math.round(((step + 1) / STEPS.length) * 100), [step]);

  return (
    <form action={action} className="space-y-6" noValidate>
      <ol className="flex flex-wrap gap-2" aria-label="Onboarding steps">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", i === step ? "border-primary bg-primary text-white" : i < step ? "border-success/40 bg-green-50 text-success" : "border-border bg-white text-muted-foreground")}
              aria-current={i === step ? "step" : undefined}
              disabled={i > step}
            >
              {i < step ? <Check className="size-3" aria-hidden="true" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding progress">
        <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div>
        <h2 className="text-xl font-bold">{STEPS[step]!.title}</h2>
        <p className="text-sm text-muted-foreground">{STEPS[step]!.description}</p>
      </div>

      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}

      {/* Step 1: personal + business name + trade */}
      <div className={cn("space-y-4", step !== 0 && "hidden")}>
        <Field label="Your full name" htmlFor="fullName" required error={err("fullName")}>
          <Input id="fullName" name="fullName" defaultValue={props.defaultName} autoComplete="name" required />
        </Field>
        <Field label="Business name" htmlFor="businessName" required error={err("businessName")} hint="Shown on every quote.">
          <Input id="businessName" name="businessName" autoComplete="organization" required />
        </Field>
        <Field label="Your trade" htmlFor="tradeSlug" required error={err("tradeSlug")} hint="We use this to suggest a starter catalogue and wording.">
          <Select id="tradeSlug" name="tradeSlug" defaultValue="electrician" required>
            {props.trades.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Step 2: address and contact */}
      <div className={cn("space-y-4", step !== 1 && "hidden")}>
        <Field label="Address line 1" htmlFor="addressLine1" error={err("addressLine1")}>
          <Input id="addressLine1" name="addressLine1" autoComplete="address-line1" />
        </Field>
        <Field label="Address line 2" htmlFor="addressLine2" error={err("addressLine2")}>
          <Input id="addressLine2" name="addressLine2" autoComplete="address-line2" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Town or city" htmlFor="city" error={err("city")}>
            <Input id="city" name="city" autoComplete="address-level2" />
          </Field>
          <Field label="County, state or region" htmlFor="region" error={err("region")}>
            <Input id="region" name="region" autoComplete="address-level1" />
          </Field>
          <Field label="Postcode or ZIP" htmlFor="postalCode" error={err("postalCode")}>
            <Input id="postalCode" name="postalCode" autoComplete="postal-code" />
          </Field>
          <Field label="Country code" htmlFor="country" required error={err("country")} hint="Two letters, e.g. GB, US, AU.">
            <Input id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} autoComplete="country" required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business phone" htmlFor="phone" error={err("phone")}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label="Business email" htmlFor="email" error={err("email")}>
            <Input id="email" name="email" type="email" inputMode="email" defaultValue={props.defaultEmail} autoComplete="email" />
          </Field>
        </div>
        <Field label="Website" htmlFor="website" error={err("website")}>
          <Input id="website" name="website" inputMode="url" placeholder="example.com" />
        </Field>
      </div>

      {/* Step 3: currency and tax */}
      <div className={cn("space-y-4", step !== 2 && "hidden")}>
        <Field label="Currency" htmlFor="currency" required error={err("currency")}>
          <Select
            id="currency"
            name="currency"
            value={currency}
            onChange={(e) => {
              const next = e.target.value;
              setCurrency(next);
              const preset = CURRENCY_DEFAULTS[next];
              if (preset) {
                setTaxMode(preset.taxMode);
                setTaxRate(String(TAX_PRESETS[preset.taxMode]?.rate ?? 0));
                setCountry(preset.country);
              }
            }}
          >
            {props.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tax setting" htmlFor="taxMode" required error={err("taxMode")}>
          <Select
            id="taxMode"
            name="taxMode"
            value={taxMode}
            onChange={(e) => {
              setTaxMode(e.target.value);
              setTaxRate(String(TAX_PRESETS[e.target.value]?.rate ?? 0));
            }}
          >
            {Object.entries(TAX_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        {taxMode === "CUSTOM" ? (
          <Field label="Tax label" htmlFor="taxLabel" required error={err("taxLabel")} hint="Shown on quotes, e.g. HST or Service tax.">
            <Input id="taxLabel" name="taxLabel" defaultValue="Tax" />
          </Field>
        ) : (
          <input type="hidden" name="taxLabel" value={TAX_PRESETS[taxMode]?.taxLabel ?? ""} />
        )}
        <div className={cn("grid gap-4 sm:grid-cols-2", taxMode === "NONE" && "hidden")}>
          <Field label="Default tax percentage" htmlFor="taxRatePercent" required error={err("taxRatePercent")}>
            <Input id="taxRatePercent" name="taxRatePercent" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </Field>
          <Field label="Prices you enter are" htmlFor="pricingMode" required error={err("pricingMode")}>
            <Select id="pricingMode" name="pricingMode" defaultValue="TAX_EXCLUSIVE">
              <option value="TAX_EXCLUSIVE">Excluding tax (tax added on top)</option>
              <option value="TAX_INCLUSIVE">Including tax</option>
            </Select>
          </Field>
        </div>
        {taxMode === "NONE" ? (
          <>
            <input type="hidden" name="taxRatePercent" value="0" />
            <input type="hidden" name="pricingMode" value="NO_TAX" />
          </>
        ) : null}
      </div>

      {/* Step 4: rates and terms */}
      <div className={cn("space-y-4", step !== 3 && "hidden")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Labour rate (${currency})`} htmlFor="labourRate" required error={err("labourRate")}>
            <Input id="labourRate" name="labourRate" type="number" inputMode="decimal" min={0} step="0.01" defaultValue="45" />
          </Field>
          <Field label="Per" htmlFor="labourRateUnit" required>
            <Select id="labourRateUnit" name="labourRateUnit" value={labourUnit} onChange={(e) => setLabourUnit(e.target.value)}>
              <option value="HOUR">Hour</option>
              <option value="DAY">Day</option>
            </Select>
          </Field>
          <Field label={`Call-out fee (${currency})`} htmlFor="callOutFee" required error={err("callOutFee")} hint="Set 0 if you do not charge one.">
            <Input id="callOutFee" name="callOutFee" type="number" inputMode="decimal" min={0} step="0.01" defaultValue="0" />
          </Field>
        </div>
        <Field label="Payment terms" htmlFor="paymentTerms" required error={err("paymentTerms")} hint="Printed on every quote. You can change it per quote.">
          <Textarea id="paymentTerms" name="paymentTerms" defaultValue={props.defaultTerms} rows={3} />
        </Field>
        <Field label="Quote validity (days)" htmlFor="quoteValidityDays" required error={err("quoteValidityDays")}>
          <Input id="quoteValidityDays" name="quoteValidityDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={props.defaultValidityDays} className="max-w-[10rem]" />
        </Field>
      </div>

      {/* Step 5: branding */}
      <div className={cn("space-y-4", step !== 4 && "hidden")}>
        <div>
          <p className="text-sm font-medium">Business logo</p>
          <p className="mb-2 text-xs text-muted-foreground">Optional. You can add or change it later in Business settings.</p>
          <LogoUpload maxMb={props.maxLogoMb} />
        </div>
        <Field label="Brand colour" htmlFor="brandColor" required error={err("brandColor")} hint="Used for headings on your quotes.">
          <div className="flex items-center gap-3">
            <input id="brandColor-picker" type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="size-11 cursor-pointer rounded-lg border bg-white p-1" aria-label="Pick brand colour" />
            <Input id="brandColor" name="brandColor" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="max-w-[10rem] font-mono" pattern="^#[0-9a-fA-F]{6}$" />
          </div>
        </Field>
      </div>

      {/* Step 6: finish */}
      <div className={cn("space-y-4", step !== 5 && "hidden")}>
        <label className="flex items-start gap-3 rounded-lg border bg-white p-4">
          <input type="checkbox" name="includeCatalogue" defaultChecked className="mt-1 size-4 accent-primary" />
          <span>
            <span className="block text-sm font-semibold">Create a starter service catalogue for my trade</span>
            <span className="block text-xs text-muted-foreground">Example services with editable prices. You can import your own from CSV later.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border bg-white p-4">
          <input type="checkbox" name="createSampleQuote" defaultChecked className="mt-1 size-4 accent-primary" />
          <span>
            <span className="block text-sm font-semibold">Create a sample quote so I can explore the wizard</span>
            <span className="block text-xs text-muted-foreground">A safe-to-delete draft with a sample customer and a few line items.</span>
          </span>
        </label>
        <Alert variant="info">You can change every setting later in Business settings.</Alert>
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
          <ArrowLeft /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button type="submit" size="lg" variant="accent" loading={pending || state?.ok === true}>
            Finish setup
          </Button>
        )}
      </div>
    </form>
  );
}
