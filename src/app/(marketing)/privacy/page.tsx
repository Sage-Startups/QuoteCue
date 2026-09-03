import type { Metadata } from "next";
import { LEGAL_LAST_UPDATED, privacyPolicy } from "@/components/marketing/legal-content";
import { LegalPage } from "@/components/marketing/legal-page";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/privacy", { title: "Privacy policy", description: "How QuoteCue AI collects, uses and protects personal data." });
}

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  const env = getEnv();
  const source = privacyPolicy({ settings, appUrl: env.APP_URL, analyticsConfigured: Boolean(env.ANALYTICS_ID) });
  return (
    <LegalPage
      title="Privacy policy"
      intro={`How ${settings["branding.companyName"]} collects, uses and protects personal data when you use ${settings["branding.productName"]}.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      source={source}
      current="/privacy"
    />
  );
}
