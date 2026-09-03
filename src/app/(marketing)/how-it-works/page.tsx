import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getMarketingContent } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/how-it-works", { title: "How it works" });
}

/** Supporting detail for each step, in the same order as the content steps. */
const STEP_DETAILS: Array<{ points: string[]; note: string }> = [
  {
    points: ["Paste the customer's WhatsApp, email or web enquiry", "Add a voice note recorded on site or in the van", "Upload photographs and PDF documents", "Pick or create the customer record"],
    note: "Nothing is sent to the AI until you press analyse.",
  },
  {
    points: ["Work activities with quantities and units", "Matches to your own service catalogue, or flagged as unpriced", "Confidence level, assumptions and photo caveats on every item", "Questions you still need to ask the customer"],
    note: "Accept, edit or remove each suggestion. Unmatched items stay unpriced until you decide.",
  },
  {
    points: ["Adjust quantities, unit rates and descriptions", "Add discounts, call-out fees and tax settings", "Choose tax-inclusive or tax-exclusive pricing", "See margin on internal costs if you record them"],
    note: "Every total is calculated on the server with the same arithmetic every time.",
  },
  {
    points: ["Preview the branded quote with your logo and terms", "Download the PDF or email it from the app", "Share a secure link the customer can accept online", "Get notified when it is viewed, accepted or declined"],
    note: "Follow-up email wording is drafted for you and stays fully editable.",
  },
];

export default async function HowItWorksPage() {
  const [content, settings] = await Promise.all([getMarketingContent(), getSiteSettings()]);
  const section = content["home.howItWorks"];
  const registrationEnabled = settings["app.registrationEnabled"];

  return (
    <>
      <PageIntro eyebrow="Process" title={section.heading} description={section.description}>
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

      <Section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="sr-only">
          The four steps
        </h2>
        <ol className="space-y-6">
          {section.steps.map((step, index) => {
            const detail = STEP_DETAILS[index];
            return (
              <li key={step.title} className="grid gap-6 rounded-2xl border bg-white p-6 shadow-card md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:p-8">
                <div>
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-navy-900 text-base font-bold text-white" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
                {detail ? (
                  <div className="rounded-xl bg-background p-5">
                    <ul className="space-y-2.5 text-sm text-foreground/90">
                      {detail.points.map((point) => (
                        <li key={point} className="flex items-start gap-2.5">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{detail.note}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section aria-labelledby="responsibility-heading" tone="dark">
        <SectionHeading
          id="responsibility-heading"
          eyebrow="Our responsibility model"
          title="AI proposes, you decide, arithmetic is deterministic."
          description="QuoteCue is a business tool with clear boundaries, not a chatbot that guesses."
          tone="dark"
        />
        <ul className="grid gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "AI proposes", body: "The AI identifies likely work, quantities, wording and questions. It never invents a price and it never claims a photo proves hidden conditions, compliance or safety." },
            { icon: UserCheck, title: "You decide", body: "Every suggestion is reviewed, edited or removed by you. Unmatched items stay unpriced until you approve them. You remain responsible for the quote you send." },
            { icon: Calculator, title: "Arithmetic is deterministic", body: "Quantities, rates, discounts and tax are calculated on the server with the same code every time, so totals are reproducible and auditable." },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-white/10 text-amber-300">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-100">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="hiw-cta-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="hiw-cta-heading" className="text-balance text-3xl font-bold tracking-tight text-foreground">
            {content["home.finalCta"].heading}
          </h2>
          <p className="mt-4 text-muted-foreground">{content["home.finalCta"].description}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {registrationEnabled ? (
              <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                <Link href={content["home.finalCta"].primaryCta.href}>{content["home.finalCta"].primaryCta.label}</Link>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <Link href={content["home.finalCta"].secondaryCta.href}>{content["home.finalCta"].secondaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
