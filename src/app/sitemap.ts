import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { isDemoAvailable } from "@/lib/services/demo";

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
  if (await isDemoAvailable()) routes.splice(5, 0, ["/demo", 0.8, "monthly"]);
  return routes.map(([path, priority, changeFrequency]) => ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority }));
}
