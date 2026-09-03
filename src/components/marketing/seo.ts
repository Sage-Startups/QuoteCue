import type { Metadata } from "next";
import { getMarketingSection } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEnv } from "@/lib/env";

/**
 * Builds page metadata for a marketing route. Titles and descriptions are
 * read from the admin-editable "seo.pages" content, falling back to the site
 * default title/description. The canonical URL is always `${APP_URL}${path}`.
 */
export async function buildPageMetadata(path: string, fallback?: { title?: string; description?: string }): Promise<Metadata> {
  const [settings, seo] = await Promise.all([getSiteSettings(), getMarketingSection("seo.pages")]);
  const env = getEnv();
  const page = seo.pages.find((p) => p.path === path);
  const productName = settings["branding.productName"];
  const isHome = path === "/";
  const title = page?.title ?? fallback?.title;
  const description = page?.description ?? fallback?.description ?? settings["seo.defaultDescription"];
  const canonical = `${env.APP_URL}${isHome ? "" : path}` || env.APP_URL;
  const resolvedTitle = isHome || !title ? settings["seo.defaultTitle"] : `${title} · ${productName}`;

  return {
    title: isHome || !title ? { absolute: settings["seo.defaultTitle"] } : title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: productName,
      title: resolvedTitle,
      description,
      url: canonical,
      images: ["/og-image.png"],
    },
    twitter: { card: "summary_large_image", title: resolvedTitle, description },
  };
}
