import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, ListX } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingIcon } from "@/components/marketing/icon";
import { IconTile, PageIntro, Section } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getMarketingContent } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils/money";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/templates", { title: "Trade templates" });
}

const serviceSchema = z
  .object({
    name: z.string(),
    category: z.string().optional(),
    unit: z.string().optional(),
    kind: z.string().optional(),
    unitPriceMinor: z.number().optional(),
    customerDescription: z.string().optional(),
  })
  .loose();

const stringList = z.array(z.string());

const UNIT_LABELS: Record<string, string> = {
  HOUR: "per hour",
  DAY: "per day",
  ITEM: "each",
  METRE: "per metre",
  SQUARE_METRE: "per m²",
  VISIT: "per visit",
  FIXED: "fixed price",
};

function parseServices(value: unknown) {
  const parsed = z.array(serviceSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseStrings(value: unknown): string[] {
  const parsed = stringList.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export default async function TemplatesPage() {
  const [templates, content, settings] = await Promise.all([
    prisma.tradeTemplate.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    getMarketingContent(),
    getSiteSettings(),
  ]);
  const trades = content["home.trades"];
  const registrationEnabled = settings["app.registrationEnabled"];

  return (
    <>
      <PageIntro eyebrow="Templates" title={trades.heading} description={trades.description}>
        {registrationEnabled ? (
          <Button asChild size="lg" variant="accent">
            <Link href="/signup">
              Start with a template
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <Button asChild size="lg" variant="secondary">
          <Link href="/demo">Explore the live demo</Link>
        </Button>
      </PageIntro>

      <Section aria-labelledby="templates-heading">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 id="templates-heading" className="text-2xl font-bold tracking-tight text-foreground">
            {templates.length > 0 ? `${templates.length} starting catalogues` : "Starting catalogues"}
          </h2>
          <Badge variant="warning" className="w-fit">
            Example prices — fully editable
          </Badge>
        </div>

        {templates.length === 0 ? (
          <p className="rounded-2xl border bg-white p-8 text-center text-muted-foreground">Trade templates are being prepared. Every workspace can still build its catalogue from scratch.</p>
        ) : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {templates.map((template) => {
              const services = parseServices(template.suggestedServices).slice(0, 4);
              const exclusions = parseStrings(template.commonExclusions).slice(0, 3);
              const questions = parseStrings(template.commonQuestions).slice(0, 3);
              return (
                <li key={template.id} id={template.slug} className="flex flex-col rounded-2xl border bg-white p-6 shadow-card md:p-7">
                  <div className="flex items-start gap-4">
                    <IconTile>
                      <MarketingIcon name={template.icon} className="size-5" />
                    </IconTile>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-foreground">{template.name}</h3>
                      {template.description ? <p className="mt-1 text-sm text-muted-foreground">{template.description}</p> : null}
                    </div>
                  </div>

                  {services.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Example services</p>
                      <ul className="mt-2 divide-y rounded-xl border">
                        {services.map((service) => (
                          <li key={service.name} className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{service.name}</p>
                              {service.category ? <p className="text-xs text-muted-foreground">{service.category}</p> : null}
                            </div>
                            {typeof service.unitPriceMinor === "number" ? (
                              <p className="tabular shrink-0 text-right text-sm text-foreground">
                                {formatMoney(service.unitPriceMinor, "GBP")}
                                <span className="block text-xs text-muted-foreground">{UNIT_LABELS[service.unit ?? ""] ?? ""}</span>
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">Example prices — fully editable. Set your own rates and currency during onboarding.</p>
                    </div>
                  ) : null}

                  {template.defaultScope ? (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Scope wording</p>
                      <blockquote className="mt-2 rounded-xl bg-background px-4 py-3 text-sm leading-relaxed text-foreground/90">
                        <p>{template.defaultScope}</p>
                      </blockquote>
                    </div>
                  ) : null}

                  {exclusions.length > 0 || questions.length > 0 ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {exclusions.length > 0 ? (
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            <ListX className="size-3.5" aria-hidden="true" />
                            Common exclusions
                          </p>
                          <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
                            {exclusions.map((item) => (
                              <li key={item} className="flex items-start gap-2">
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-navy-300" aria-hidden="true" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {questions.length > 0 ? (
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            <CircleHelp className="size-3.5" aria-hidden="true" />
                            Questions to ask
                          </p>
                          <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
                            {questions.map((item) => (
                              <li key={item} className="flex items-start gap-2">
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {template.defaultTerms ? (
                    <details className="mt-5 rounded-xl border bg-background">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">Default terms</summary>
                      <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{template.defaultTerms}</p>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section aria-labelledby="templates-cta-heading" tone="dark">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="templates-cta-heading" className="text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
            Every template is a starting point, not a rulebook.
          </h2>
          <p className="mt-4 text-navy-100">Choose your trade during onboarding, then rename, reprice or delete anything. Your catalogue is yours.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {registrationEnabled ? (
              <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                <Link href="/signup">Create my first quote</Link>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 hover:text-white sm:w-auto">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
