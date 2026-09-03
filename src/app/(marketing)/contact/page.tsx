import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MessageCircleQuestion } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { Container, Section } from "@/components/marketing/section";
import { buildPageMetadata } from "@/components/marketing/seo";
import { getMarketingContent } from "@/lib/config/marketing-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { submitContactAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("/contact", { title: "Contact" });
}

export default async function ContactPage() {
  const [content, settings] = await Promise.all([getMarketingContent(), getSiteSettings()]);
  const copy = content["contact.copy"];
  const supportEmail = settings["branding.supportEmail"];

  return (
    <>
      <div className="border-b bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Contact</p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">{copy.heading}</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">{copy.description}</p>
          </div>
        </Container>
      </div>

      <Section aria-label="Contact form and details">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
          <div className="relative rounded-2xl border bg-white p-6 shadow-card md:p-8">
            <h2 className="text-xl font-semibold text-foreground">Send us a message</h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">All fields marked with an asterisk are required.</p>
            <ContactForm action={submitContactAction} />
          </div>
          <aside className="space-y-5">
            <div className="rounded-2xl border bg-white p-6 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                  <Mail className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Email support</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Prefer your own inbox? Write to us directly.</p>
                  <a href={`mailto:${supportEmail}`} className="mt-2 inline-flex min-h-11 items-center break-all font-medium text-primary underline-offset-4 hover:underline">
                    {supportEmail}
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-6 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                  <Clock className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Response times</h2>
                  <p className="mt-1 text-sm text-muted-foreground">We reply by email, usually within one working day. Pro plan customers receive priority support.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-6 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                  <MessageCircleQuestion className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Quick answers</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Many questions about pricing, AI generations and data are answered in the FAQ.</p>
                  <Link href="/faq" className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
                    Read the FAQ
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
