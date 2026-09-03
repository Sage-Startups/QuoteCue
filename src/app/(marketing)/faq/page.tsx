import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaqList } from "@/components/marketing/faq-list";
import { JsonLd } from "@/components/marketing/json-ld";
import { Container, Section } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getMarketingContent } from "@/lib/config/marketing-content";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/faq", { title: "FAQ" });
}

export default async function FaqPage() {
  const content = await getMarketingContent();
  const faq = content.faq;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="border-b bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">FAQ</p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">{faq.heading}</h1>
            <p className="mt-4 text-lg text-muted-foreground">Straight answers about how the AI works, what you pay for and where your data lives.</p>
          </div>
        </Container>
      </div>
      <Section aria-label="Questions and answers">
        <div className="mx-auto max-w-3xl">
          {faq.items.length > 0 ? <FaqList items={faq.items} /> : <p className="rounded-2xl border bg-white p-8 text-center text-muted-foreground">No questions have been published yet.</p>}
          <div className="mt-10 rounded-2xl border bg-white p-6 text-center shadow-card">
            <h2 className="text-lg font-semibold text-foreground">Still have a question?</h2>
            <p className="mt-1 text-sm text-muted-foreground">We are happy to help before you sign up.</p>
            <Link href="/contact" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Contact us
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
