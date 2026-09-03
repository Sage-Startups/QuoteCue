import type { Metadata } from "next";
import { LEGAL_LAST_UPDATED, termsOfService } from "@/components/marketing/legal-content";
import { LegalPage } from "@/components/marketing/legal-page";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/terms", { title: "Terms of service", description: "The terms that govern your use of QuoteCue AI." });
}

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const env = getEnv();
  const source = termsOfService({ settings, appUrl: env.APP_URL, analyticsConfigured: Boolean(env.ANALYTICS_ID) });
  return (
    <LegalPage
      title="Terms of service"
      intro={`The agreement between you and ${settings["branding.companyName"]} for using ${settings["branding.productName"]}.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      source={source}
      current="/terms"
    />
  );
}
