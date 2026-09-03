import type { Metadata } from "next";
import { cookiePolicy, LEGAL_LAST_UPDATED } from "@/components/marketing/legal-content";
import { LegalPage } from "@/components/marketing/legal-page";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/cookies", { title: "Cookie policy", description: "The cookies QuoteCue AI uses and why." });
}

export default async function CookiesPage() {
  const settings = await getSiteSettings();
  const env = getEnv();
  const source = cookiePolicy({ settings, appUrl: env.APP_URL, analyticsConfigured: Boolean(env.ANALYTICS_ID) });
  return (
    <LegalPage
      title="Cookie policy"
      intro={`The small number of cookies ${settings["branding.productName"]} sets, what they do and how long they last.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      source={source}
      current="/cookies"
    />
  );
}
