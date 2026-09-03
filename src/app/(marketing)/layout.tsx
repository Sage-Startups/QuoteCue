import { getMarketingSection } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { AnnouncementBanner, SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [settings, footer] = await Promise.all([getSiteSettings(), getMarketingSection("footer")]);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-elevated"
      >
        Skip to main content
      </a>
      <AnnouncementBanner settings={settings} />
      <SiteHeader settings={settings} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter settings={settings} footer={footer} />
    </div>
  );
}
