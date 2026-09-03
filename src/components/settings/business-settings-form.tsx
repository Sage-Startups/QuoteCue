"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, Alert } from "@/components/ui/misc";
import { LogoUpload } from "@/components/uploads/logo-upload";
import { saveBusinessSettingsAction } from "@/app/app/settings/actions";

export interface BusinessSettingsValues {
  businessName: string;
  tradeSlug: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  currency: string;
  taxMode: string;
  taxLabel: string;
  taxRatePercent: string;
  taxNumber: string;
  pricingMode: string;
  labourRate: string;
  labourRateUnit: string;
  callOutFee: string;
  paymentTerms: string;
  depositTerms: string;
  warrantyWording: string;
  quoteValidityDays: string;
  quoteNumberPrefix: string;
  quoteFooter: string;
  brandColor: string;
  accentColor: string;
  logoObjectId: string;
  logoUrl: string | null;
}

export function BusinessSettingsForm({ values, trades, currencies, canCustomLogo, canFullBranding, maxLogoMb }: { values: BusinessSettingsValues; trades: Array<{ slug: string; name: string }>; currencies: string[]; canCustomLogo: boolean; canFullBranding: boolean; maxLogoMb: number }) {
  const [state, action, pending] = useActionState(saveBusinessSettingsAction, null);
  const [taxMode, setTaxMode] = useState(values.taxMode);
  const [brandColor, setBrandColor] = useState(values.brandColor);
  const [accentColor, setAccentColor] = useState(values.accentColor);
  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="previousLogoObjectId" value={values.logoObjectId} />
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Business profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="businessName" required error={err("businessName")}>
            <Input id="businessName" name="businessName" defaultValue={values.businessName} required />
          </Field>
          <Field label="Trade" htmlFor="tradeSlug" required error={err("tradeSlug")}>
            <Select id="tradeSlug" name="tradeSlug" defaultValue={values.tradeSlug}>
              {trades.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contact name" htmlFor="contactName" error={err("contactName")}>
            <Input id="contactName" name="contactName" defaultValue={values.contactName} />
          </Field>
          <Field label="Business email" htmlFor="email" error={err("email")}>
            <Input id="email" name="email" type="email" defaultValue={values.email} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={err("phone")}>
            <Input id="phone" name="phone" type="tel" defaultValue={values.phone} />
          </Field>
          <Field label="Website" htmlFor="website" error={err("website")}>
            <Input id="website" name="website" defaultValue={values.website} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" htmlFor="addressLine1">
            <Input id="addressLine1" name="addressLine1" defaultValue={values.addressLine1} />
          </Field>
          <Field label="Address line 2" htmlFor="addressLine2">
            <Input id="addressLine2" name="addressLine2" defaultValue={values.addressLine2} />
          </Field>
          <Field label="Town or city" htmlFor="city">
            <Input id="city" name="city" defaultValue={values.city} />
          </Field>
          <Field label="Region" htmlFor="region">
            <Input id="region" name="region" defaultValue={values.region} />
          </Field>
          <Field label="Postcode" htmlFor="postalCode">
            <Input id="postalCode" name="postalCode" defaultValue={values.postalCode} />
          </Field>
          <Field label="Country code" htmlFor="country" required error={err("country")}>
            <Input id="country" name="country" defaultValue={values.country} maxLength={2} required />
          </Field>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Currency and tax</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="currency" required error={err("currency")} hint="Applies to new quotes.">
            <Select id="currency" name="currency" defaultValue={values.currency}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tax setting" htmlFor="taxMode" required>
            <Select id="taxMode" name="taxMode" value={taxMode} onChange={(e) => setTaxMode(e.target.value)}>
              <option value="NONE">No tax</option>
              <option value="VAT">VAT</option>
              <option value="GST">GST</option>
              <option value="SALES_TAX">Sales tax</option>
              <option value="CUSTOM">Custom tax</option>
            </Select>
          </Field>
          {taxMode === "CUSTOM" ? (
            <Field label="Tax label" htmlFor="taxLabel" required error={err("taxLabel")}>
              <Input id="taxLabel" name="taxLabel" defaultValue={values.taxLabel} />
            </Field>
          ) : (
            <input type="hidden" name="taxLabel" value="" />
          )}
          {taxMode !== "NONE" ? (
            <>
              <Field label="Default tax percentage" htmlFor="taxRatePercent" required error={err("taxRatePercent")}>
                <Input id="taxRatePercent" name="taxRatePercent" type="number" inputMode="decimal" min={0} max={100} step="0.01" defaultValue={values.taxRatePercent} />
              </Field>
              <Field label="Tax registration number" htmlFor="taxNumber" error={err("taxNumber")} hint="Printed on quotes if set.">
                <Input id="taxNumber" name="taxNumber" defaultValue={values.taxNumber} />
              </Field>
              <Field label="Prices you enter are" htmlFor="pricingMode" required>
                <Select id="pricingMode" name="pricingMode" defaultValue={values.pricingMode === "NO_TAX" ? "TAX_EXCLUSIVE" : values.pricingMode}>
                  <option value="TAX_EXCLUSIVE">Excluding tax</option>
                  <option value="TAX_INCLUSIVE">Including tax</option>
                </Select>
              </Field>
            </>
          ) : (
            <>
              <input type="hidden" name="taxRatePercent" value="0" />
              <input type="hidden" name="pricingMode" value="NO_TAX" />
            </>
          )}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Rates and terms</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Labour rate" htmlFor="labourRate" required error={err("labourRate")}>
            <Input id="labourRate" name="labourRate" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={values.labourRate} />
          </Field>
          <Field label="Per" htmlFor="labourRateUnit" required>
            <Select id="labourRateUnit" name="labourRateUnit" defaultValue={values.labourRateUnit}>
              <option value="HOUR">Hour</option>
              <option value="DAY">Day</option>
            </Select>
          </Field>
          <Field label="Call-out fee" htmlFor="callOutFee" required error={err("callOutFee")}>
            <Input id="callOutFee" name="callOutFee" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={values.callOutFee} />
          </Field>
        </div>
        <Field label="Payment terms" htmlFor="paymentTerms" required error={err("paymentTerms")}>
          <Textarea id="paymentTerms" name="paymentTerms" defaultValue={values.paymentTerms} rows={3} />
        </Field>
        <Field label="Deposit terms" htmlFor="depositTerms" error={err("depositTerms")} hint="Optional text such as '25% deposit before materials are ordered'.">
          <Textarea id="depositTerms" name="depositTerms" defaultValue={values.depositTerms} rows={2} />
        </Field>
        <Field label="Warranty wording" htmlFor="warrantyWording" error={err("warrantyWording")}>
          <Textarea id="warrantyWording" name="warrantyWording" defaultValue={values.warrantyWording} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quote validity (days)" htmlFor="quoteValidityDays" required error={err("quoteValidityDays")}>
            <Input id="quoteValidityDays" name="quoteValidityDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={values.quoteValidityDays} />
          </Field>
          <Field label="Quote number prefix" htmlFor="quoteNumberPrefix" required error={err("quoteNumberPrefix")} hint="e.g. QC gives QC-2026-0001.">
            <Input id="quoteNumberPrefix" name="quoteNumberPrefix" defaultValue={values.quoteNumberPrefix} maxLength={6} className="uppercase" />
          </Field>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Branding</h2>
        {!canCustomLogo ? <Alert variant="info">Custom logos are included on paid plans. Your quotes currently show your business name in place of a logo.</Alert> : null}
        <LogoUpload initialObjectId={values.logoObjectId} initialUrl={values.logoUrl} maxMb={maxLogoMb} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand colour" htmlFor="brandColor" required error={err("brandColor")} hint={canFullBranding ? "Used for headings on quotes." : "Full custom branding is a Pro feature; quotes use the default palette until you upgrade."}>
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="size-11 rounded-lg border bg-white p-1" aria-label="Pick brand colour" />
              <Input id="brandColor" name="brandColor" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="max-w-[10rem] font-mono" />
            </div>
          </Field>
          <Field label="Accent colour" htmlFor="accentColor" required error={err("accentColor")}>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="size-11 rounded-lg border bg-white p-1" aria-label="Pick accent colour" />
              <Input id="accentColor" name="accentColor" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="max-w-[10rem] font-mono" />
            </div>
          </Field>
        </div>
        <Field label="Quote footer" htmlFor="quoteFooter" error={err("quoteFooter")} hint="Printed at the bottom of every page, e.g. registration numbers.">
          <Input id="quoteFooter" name="quoteFooter" defaultValue={values.quoteFooter} />
        </Field>
      </section>
      <div className="flex justify-end border-t pt-4">
        <Button type="submit" size="lg" loading={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
