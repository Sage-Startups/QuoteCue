import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingIcon } from "@/components/marketing/icon";
import { IconTile, PageIntro, Section } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getMarketingContent } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/features", { title: "Features" });
}

interface FeatureGroup {
  key: string;
  title: string;
  description: string;
  icons: string[];
  details: string[];
}

/**
 * Feature cards come from admin-editable content and are grouped by their
 * icon. The group titles and supporting detail lines describe product
 * behaviour that is fixed in code, so they live here rather than in content.
 */
const GROUPS: FeatureGroup[] = [
  {
    key: "capture",
    title: "Capture",
    description: "Get the job into QuoteCue however it reached you.",
    icons: ["message-square", "mic", "camera"],
    details: ["Paste text or type rough notes", "Record a voice note on your phone", "Upload photos and PDF documents", "Works on the phone in your pocket"],
  },
  {
    key: "analyse",
    title: "Analyse",
    description: "The AI reads the enquiry and proposes the work with its reasoning on show.",
    icons: ["sparkles", "list-checks", "file-text"],
    details: ["Work activities, quantities and open questions", "Confidence levels on every suggestion", "Assumptions and photo caveats called out", "Nothing is priced until it matches your catalogue"],
  },
  {
    key: "price",
    title: "Price",
    description: "Your rates, applied by deterministic arithmetic on the server.",
    icons: ["calculator"],
    details: ["Quantities, unit rates, discounts and call-out fees", "Tax-inclusive or exclusive totals with the right label", "Six currencies supported", "Every total reproducible, never estimated by the AI"],
  },
  {
    key: "send",
    title: "Send & track",
    description: "A professional document and a secure link, with activity you can see.",
    icons: ["file-down", "link", "bar-chart-3"],
    details: ["Branded multi-page PDFs", "Secure links customers can accept or decline online", "Email notifications when a quote is viewed or accepted", "Acceptance rate and value quoted from your own data"],
  },
  {
    key: "team",
    title: "Team & admin",
    description: "Shared workspace, sensible permissions, exportable data.",
    icons: ["users"],
    details: ["Invite colleagues with owner, admin and member roles", "Shared customers, catalogues and templates", "CSV exports of quotes and customers", "Audit trail of quote changes"],
  },
];

export default async function FeaturesPage() {
  const [content, settings] = await Promise.all([getMarketingContent(), getSiteSettings()]);
  const cards = [...content["home.inputs"].items, ...content["home.features"].items];
  const used = new Set<string>();
  const groups = GROUPS.map((group) => {
    const items = cards.filter((card) => {
      const icon = card.icon.toLowerCase();
      if (!group.icons.includes(icon) || used.has(card.title)) return false;
      used.add(card.title);
      return true;
    });
    return { ...group, items };
  });
  const leftovers = cards.filter((card) => !used.has(card.title));
  if (leftovers.length > 0) {
    groups.push({ key: "more", title: "And more", description: "Further capabilities available in every workspace.", icons: [], details: [], items: leftovers });
  }
  const registrationEnabled = settings["app.registrationEnabled"];

  return (
    <>
      <PageIntro eyebrow="Features" title={content["home.features"].heading} description={content["home.features"].description}>
        {registrationEnabled ? (
          <Button asChild size="lg" variant="accent">
            <Link href="/signup">
              Create my first quote
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <Button asChild size="lg" variant="secondary">
          <Link href="/demo">Explore the live demo</Link>
        </Button>
      </PageIntro>

      <nav aria-label="Feature groups" className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
          {groups.map((group) => (
            <a key={group.key} href={`#${group.key}`} className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {group.title}
            </a>
          ))}
        </div>
      </nav>

      {groups.map((group, index) => (
        <Section key={group.key} id={group.key} aria-labelledby={`${group.key}-heading`} tone={index % 2 === 1 ? "muted" : "default"} className="scroll-mt-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 id={`${group.key}-heading`} className="text-3xl font-bold tracking-tight text-foreground">
                {group.title}
              </h2>
              <p className="mt-3 text-base text-muted-foreground">{group.description}</p>
              {group.details.length > 0 ? (
                <ul className="mt-5 space-y-2 text-sm text-foreground/90">
                  {group.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2.5">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <ul className={cn("grid gap-5", group.items.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
              {group.items.map((item) => (
                <li key={item.title} className={cn("flex flex-col rounded-2xl border p-6 shadow-card", index % 2 === 1 ? "bg-background" : "bg-white")}>
                  <IconTile tone={index % 2 === 1 ? "accent" : "default"}>
                    <MarketingIcon name={item.icon} className="size-5" />
                  </IconTile>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <Section aria-labelledby="features-cta-heading" tone="dark">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="features-cta-heading" className="text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
            {content["home.finalCta"].heading}
          </h2>
          <p className="mt-4 text-navy-100">{content["home.finalCta"].description}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {registrationEnabled ? (
              <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                <Link href={content["home.finalCta"].primaryCta.href}>{content["home.finalCta"].primaryCta.label}</Link>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 hover:text-white sm:w-auto">
              <Link href={content["home.finalCta"].secondaryCta.href}>{content["home.finalCta"].secondaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
