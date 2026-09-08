import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { isDemoAvailable } from "@/lib/services/demo";

// Rendered per request: the demo check reads the database, which does not exist
// during the container build, and a statically prerendered sitemap would fail it.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getEnv().APP_URL;
  const now = new Date();
  const routes: Array<[string, number, MetadataRoute.Sitemap[number]["changeFrequency"]]> = [
    ["/", 1, "weekly"],
    ["/features", 0.9, "monthly"],
    ["/how-it-works", 0.9, "monthly"],
    ["/pricing", 0.9, "monthly"],
    ["/templates", 0.8, "monthly"],
    ["/about", 0.5, "yearly"],
    ["/contact", 0.5, "yearly"],
    ["/faq", 0.6, "monthly"],
    ["/privacy", 0.3, "yearly"],
    ["/terms", 0.3, "yearly"],
    ["/cookies", 0.3, "yearly"],
    ["/signup", 0.7, "yearly"],
    ["/login", 0.4, "yearly"],
  ];
  // Only list the demo once it can actually be opened.
  // A database blip must not take the sitemap down; omit the demo entry instead.
  if (await isDemoAvailable().catch(() => false)) routes.splice(5, 0, ["/demo", 0.8, "monthly"]);
  return routes.map(([path, priority, changeFrequency]) => ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority }));
}
