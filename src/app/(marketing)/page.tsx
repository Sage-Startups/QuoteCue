import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaqList } from "@/components/marketing/faq-list";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { MarketingIcon } from "@/components/marketing/icon";
import { JsonLd } from "@/components/marketing/json-ld";
import { getPublicPlans } from "@/components/marketing/plans";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { IconTile, Section, SectionHeading } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { Testimonials } from "@/components/marketing/testimonials";
import { getMarketingContent } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/");
}

export default async function HomePage() {
  const [settings, content, plans] = await Promise.all([getSiteSettings(), getMarketingContent(), getPublicPlans()]);
  const env = getEnv();
  const hero = content["home.hero"];
  const inputs = content["home.inputs"];
  const howItWorks = content["home.howItWorks"];
  const features = content["home.features"];
  const beforeAfter = content["home.beforeAfter"];
  const trades = content["home.trades"];
  const finalCta = content["home.finalCta"];
  const faq = content.faq;
  const subscriptionPlans = plans.filter((p) => p.kind === "SUBSCRIPTION");
  const registrationEnabled = settings["app.registrationEnabled"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: settings["branding.productName"],
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: settings["seo.defaultDescription"],
    url: env.APP_URL,
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: ((plan.kind === "CREDIT_PACK" ? plan.oneTimePriceMinor : plan.monthlyPriceMinor) / 100).toFixed(2),
      priceCurrency: "USD",
      ...(plan.kind === "SUBSCRIPTION" && plan.monthlyPriceMinor > 0 ? { billingIncrement: "P1M" } : {}),
      url: `${env.APP_URL}/pricing`,
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section aria-labelledby="hero-heading" className="border-b bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-14 sm:px-6 md:pb-20 md:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
              {hero.eyebrow}
            </p>
            <h1 id="hero-heading" className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              {hero.heading}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">{hero.description}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {registrationEnabled ? (
                <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                  <Link href={hero.primaryCta.href}>
                    {hero.primaryCta.label}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
              </Button>
            </div>
            {hero.note ? <p className="mt-4 text-sm text-muted-foreground">{hero.note}</p> : null}
          </div>
          <div className="mt-12 md:mt-16">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* Supported inputs */}
      <Section aria-labelledby="inputs-heading">
        <SectionHeading id="inputs-heading" eyebrow="Inputs" title={inputs.heading} description={inputs.description} />
        <ul className="grid gap-5 md:grid-cols-3">
          {inputs.items.map((item) => (
            <li key={item.title} className="flex flex-col rounded-2xl border bg-white p-6 shadow-card">
              <IconTile>
                <MarketingIcon name={item.icon} className="size-5" />
              </IconTile>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* How it works */}
      <Section aria-labelledby="how-heading" tone="muted">
        <SectionHeading id="how-heading" eyebrow="Process" title={howItWorks.heading} description={howItWorks.description} />
        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="relative flex flex-col rounded-2xl border bg-background p-6">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 text-center">
          <Link href="/how-it-works" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            See the full process
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* Features */}
      <Section aria-labelledby="features-heading">
        <SectionHeading id="features-heading" eyebrow="Features" title={features.heading} description={features.description} />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.items.map((item) => (
            <li key={item.title} className="flex flex-col rounded-2xl border bg-white p-6 shadow-card">
              <IconTile tone="accent">
                <MarketingIcon name={item.icon} className="size-5" />
              </IconTile>
              <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 text-center">
          <Link href="/features" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Explore all features
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* Before and after */}
      <Section aria-labelledby="before-after-heading" tone="dark">
        <SectionHeading id="before-after-heading" eyebrow={beforeAfter.label} title={beforeAfter.heading} tone="dark" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-200">Before</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-navy-100">{beforeAfter.label}</span>
            </div>
            <blockquote className="mt-4 max-w-md rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-navy-900">
              <p>{beforeAfter.before}</p>
            </blockquote>
            <p className="mt-4 text-xs text-navy-300">A typical message, exactly as it arrives.</p>
          </div>
          <div className="flex flex-col rounded-2xl bg-white p-6 text-foreground shadow-elevated">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">After</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{beforeAfter.label}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold leading-snug">{beforeAfter.afterTitle}</h3>
            <ul className="mt-4 space-y-2.5">
              {beforeAfter.afterLines.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-navy-600" aria-hidden="true" />
              Priced from your own catalogue. You review every line before sending.
            </p>
          </div>
        </div>
      </Section>

      {/* Trades */}
      <Section aria-labelledby="trades-heading">
        <SectionHeading id="trades-heading" eyebrow="Trades" title={trades.heading} description={trades.description} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trades.items.map((trade) => (
            <li key={trade.name} className="flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-card">
              <IconTile>
                <MarketingIcon name={trade.icon} className="size-5" />
              </IconTile>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">{trade.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{trade.example}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 text-center">
          <Link href="/templates" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Browse trade templates
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Testimonials content={content.testimonials} />

      {/* Pricing summary */}
      {subscriptionPlans.length > 0 ? (
        <Section aria-labelledby="pricing-heading" tone="muted">
          <SectionHeading id="pricing-heading" eyebrow="Pricing" title={content["pricing.copy"].heading} description={content["pricing.copy"].description} />
          <PricingPlans plans={subscriptionPlans} compact showToggle={false} />
          <div className="mt-8 text-center">
            <Link href="/pricing" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Compare plans and annual pricing
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Section>
      ) : null}

      {/* FAQ */}
      <Section aria-labelledby="faq-heading">
        <SectionHeading id="faq-heading" eyebrow="FAQ" title={faq.heading} />
        <div className="mx-auto max-w-3xl">
          <FaqList items={faq.items.slice(0, 6)} />
          {faq.items.length > 6 ? (
            <div className="mt-6 text-center">
              <Link href="/faq" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                Read all questions
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </div>
      </Section>

      {/* Final CTA */}
      <Section aria-labelledby="final-cta-heading" tone="dark" className="py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="final-cta-heading" className="text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
            {finalCta.heading}
          </h2>
          <p className="mt-4 text-base text-navy-100 md:text-lg">{finalCta.description}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {registrationEnabled ? (
              <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                <Link href={finalCta.primaryCta.href}>
                  {finalCta.primaryCta.label}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 hover:text-white sm:w-auto">
              <Link href={finalCta.secondaryCta.href}>{finalCta.secondaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
