import { getDemoWorkspace } from "@/lib/services/demo";
import { PageHeader } from "@/components/ui/misc";
import { DemoWizard } from "@/components/demo/demo-wizard";

export default async function DemoNewQuotePage() {
  const demo = (await getDemoWorkspace())!;
  const s = demo.settings!;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Interactive demo" title="Create a quote" description="Paste a message, let the (mock) AI analyse it, adjust the pricing and preview the finished quote. Nothing is saved." />
      <DemoWizard
        business={{ name: demo.name, contactName: null, logoDataUrl: null, addressLines: [s.addressLine1 ?? "", [s.city, s.postalCode].filter(Boolean).join(" ")].filter(Boolean), phone: s.phone, email: s.email, website: s.website, taxNumber: s.taxNumber, brandColor: s.brandColor, accentColor: s.accentColor, footer: s.quoteFooter }}
        settings={{ currency: s.currency, taxRateBps: s.taxRateBps, taxLabel: s.taxLabel, pricingMode: s.pricingMode, callOutFeeMinor: s.callOutFeeMinor, validityDays: s.quoteValidityDays }}
      />
    </div>
  );
}
