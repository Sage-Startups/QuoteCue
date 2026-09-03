import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/marketing/markdown";
import { Container, Section } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getMarketingContent } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/about", { title: "About" });
}

export default async function AboutPage() {
  const [content, settings] = await Promise.all([getMarketingContent(), getSiteSettings()]);
  const about = content["about.copy"];
  const companyName = settings["branding.companyName"];
  const address = settings["branding.companyAddress"].trim();

  return (
    <>
      <div className="border-b bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">About</p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">{about.heading}</h1>
          </div>
        </Container>
      </div>

      <Section aria-label="About the company">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border bg-white p-6 shadow-card md:p-10">
            <Markdown source={about.body} className="text-lg leading-relaxed" />
          </div>
          <aside className="space-y-6">
            <div className="rounded-2xl border bg-white p-6 shadow-card">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Our principles</h2>
              <ul className="mt-4 space-y-4">
                {[
                  { icon: ShieldCheck, title: "AI proposes", body: "Suggestions come with confidence levels, assumptions and caveats." },
                  { icon: UserCheck, title: "You decide", body: "Nothing is priced or sent without your review." },
                  { icon: Calculator, title: "Deterministic arithmetic", body: "Totals are calculated on the server, never guessed." },
                ].map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="text-sm text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-white p-6 shadow-card">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Company</h2>
              <p className="mt-3 text-sm font-semibold text-foreground">{companyName}</p>
              {address ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{address}</p> : null}
              <p className="mt-3 text-sm">
                <a href={`mailto:${settings["branding.supportEmail"]}`} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
                  {settings["branding.supportEmail"]}
                </a>
              </p>
              <Button asChild variant="secondary" className="mt-2 w-full">
                <Link href="/contact">
                  Contact us
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
