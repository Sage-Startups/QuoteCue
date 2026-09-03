import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getBusinessSettings, tradeOptions } from "@/lib/services/workspace";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { getSiteSettings } from "@/lib/config/site-settings";
import { PageHeader } from "@/components/ui/misc";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";

export const metadata: Metadata = { title: "Business settings" };

export default async function SettingsPage() {
  const ctx = await requireWorkspaceForPage("/app/settings");
  if (!ctx.isAdmin) redirect("/app");
  const [settings, entitlements, site] = await Promise.all([getBusinessSettings(ctx.workspace.id), getWorkspaceEntitlements(ctx.workspace.id), getSiteSettings()]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Business settings" description="Details, tax, rates and branding used on every quote." />
      <div className="rounded-xl border bg-card p-5 shadow-card md:p-6">
        <BusinessSettingsForm
          trades={tradeOptions()}
          currencies={site["app.supportedCurrencies"]}
          canCustomLogo={entitlements.features.CUSTOM_LOGO}
          canFullBranding={entitlements.features.FULL_BRANDING}
          maxLogoMb={site["app.maxLogoMb"]}
          values={{
            businessName: settings.businessName,
            tradeSlug: settings.tradeSlug,
            contactName: settings.contactName ?? "",
            email: settings.email ?? "",
            phone: settings.phone ?? "",
            website: settings.website ?? "",
            addressLine1: settings.addressLine1 ?? "",
            addressLine2: settings.addressLine2 ?? "",
            city: settings.city ?? "",
            region: settings.region ?? "",
            postalCode: settings.postalCode ?? "",
            country: settings.country,
            currency: settings.currency,
            taxMode: settings.taxMode,
            taxLabel: settings.taxLabel,
            taxRatePercent: (settings.taxRateBps / 100).toString(),
            taxNumber: settings.taxNumber ?? "",
            pricingMode: settings.pricingMode,
            labourRate: (settings.labourRateMinor / 100).toFixed(2),
            labourRateUnit: settings.labourRateUnit,
            callOutFee: (settings.callOutFeeMinor / 100).toFixed(2),
            paymentTerms: settings.paymentTerms,
            depositTerms: settings.depositTerms ?? "",
            warrantyWording: settings.warrantyWording ?? "",
            quoteValidityDays: String(settings.quoteValidityDays),
            quoteNumberPrefix: settings.quoteNumberPrefix,
            quoteFooter: settings.quoteFooter ?? "",
            brandColor: settings.brandColor,
            accentColor: settings.accentColor,
            logoObjectId: settings.logoObject?.id ?? "",
            logoUrl: settings.logoObject ? `/api/files/${settings.logoObject.id}` : null,
          }}
        />
      </div>
    </div>
  );
}
