import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaqList } from "@/components/marketing/faq-list";
import { getPublicPlans } from "@/components/marketing/plans";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { Container, Section, SectionHeading } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getMarketingContent } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/pricing", { title: "Pricing" });
}

const BILLING_KEYWORDS = /\b(price|pricing|plan|card|generation|credit|billing|bill|cancel|refund|trial|pay|team|user)/i;

export default async function PricingPage() {
  const [content, settings, plans] = await Promise.all([getMarketingContent(), getSiteSettings(), getPublicPlans()]);
  const copy = content["pricing.copy"];
  const billingFaq = content.faq.items.filter((item) => BILLING_KEYWORDS.test(item.question)).slice(0, 6);

  return (
    <>
      <div className="border-b bg-white">
        <Container className="py-14 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Pricing</p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">{copy.heading}</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">{copy.description}</p>
            {!settings["app.registrationEnabled"] ? <p className="mt-4 text-sm font-medium text-amber-800">Registration is currently closed. Existing customers can sign in as usual.</p> : null}
          </div>
        </Container>
      </div>

      <Section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="sr-only">
          Plans
        </h2>
        {plans.length > 0 ? (
          <PricingPlans plans={plans} />
        ) : (
          <p className="rounded-2xl border bg-white p-8 text-center text-muted-foreground">Plans are not available right now. Please check back soon or contact us.</p>
        )}
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">{copy.footnote}</p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          New workspaces start with {settings["app.trialCredits"]} free AI quote generations.
        </p>
      </Section>

      {billingFaq.length > 0 ? (
        <Section aria-labelledby="billing-faq-heading" tone="muted">
          <SectionHeading id="billing-faq-heading" eyebrow="Billing questions" title="Questions about plans and billing" />
          <div className="mx-auto max-w-3xl">
            <FaqList items={billingFaq} />
            <div className="mt-6 text-center">
              <Link href="/faq" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                Read all questions
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Section>
      ) : null}

      <Section aria-labelledby="pricing-contact-heading">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-card">
          <h2 id="pricing-contact-heading" className="text-2xl font-bold tracking-tight text-foreground">
            Need more seats or a larger allowance?
          </h2>
          <p className="mt-3 text-muted-foreground">Tell us about your team and we will put together the right plan.</p>
          <Link href="/contact" className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-navy-700">
            Contact us
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>
    </>
  );
}
