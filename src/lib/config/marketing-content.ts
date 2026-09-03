import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Marketing content is stored as structured JSON per section so super admins
 * can edit copy without touching code. Content is plain text or restricted
 * Markdown; no HTML is accepted.
 */

const linkSchema = z.object({ label: z.string().max(60), href: z.string().max(300) });
const cardSchema = z.object({ icon: z.string().max(40).default("sparkles"), title: z.string().max(80), description: z.string().max(400) });
const stepSchema = z.object({ title: z.string().max(80), description: z.string().max(400) });
const faqSchema = z.object({ question: z.string().max(200), answer: z.string().max(1500) });
const tradeSchema = z.object({ name: z.string().max(60), icon: z.string().max(40).default("wrench"), example: z.string().max(300) });
const testimonialSchema = z.object({ quote: z.string().max(600), name: z.string().max(80), role: z.string().max(120), published: z.boolean().default(false) });

export const marketingSchemas = {
  "home.hero": z.object({
    eyebrow: z.string().max(80).default("AI quoting for trades"),
    heading: z.string().max(140).default("Turn job enquiries into professional quotes in minutes."),
    description: z
      .string()
      .max(400)
      .default("Paste the customer's message, add a voice note or a few job photos, and QuoteCue AI drafts the work, prices it from your own rates and produces a branded quote your customer can accept online."),
    primaryCta: linkSchema.default({ label: "Create my first quote", href: "/signup" }),
    secondaryCta: linkSchema.default({ label: "Explore the live demo", href: "/demo" }),
    note: z.string().max(160).default("Free trial with three AI quote generations. No card required."),
  }),
  "home.inputs": z.object({
    heading: z.string().max(120).default("Works with what you already have"),
    description: z.string().max(300).default("QuoteCue reads the enquiry however it arrives."),
    items: z.array(cardSchema).max(6).default([
      { icon: "message-square", title: "Customer messages", description: "Paste a WhatsApp message, email or web enquiry. QuoteCue picks out the work, the address and the questions you still need to ask." },
      { icon: "mic", title: "Voice notes", description: "Record your notes on the way back to the van. They are transcribed and folded into the quote automatically." },
      { icon: "camera", title: "Job photographs", description: "Snap the consumer unit, the leak or the garden. Visible details are described with clear caveats about what a photo cannot prove." },
    ]),
  }),
  "home.howItWorks": z.object({
    heading: z.string().max(120).default("How it works"),
    description: z.string().max(300).default("Four steps from enquiry to accepted quote."),
    steps: z.array(stepSchema).max(6).default([
      { title: "Capture the job", description: "Paste the message, type rough notes, record a voice note or upload photos and documents." },
      { title: "Review AI suggestions", description: "See the likely work, matched to your service catalogue, with confidence levels, assumptions and missing information." },
      { title: "Price the work", description: "Adjust quantities, rates, discounts and tax. Every calculation is done deterministically, never by the AI." },
      { title: "Send the quote", description: "Preview the branded quote, download the PDF, email it or share a secure link the customer can accept online." },
    ]),
  }),
  "home.features": z.object({
    heading: z.string().max(120).default("Everything a busy trade needs to quote faster"),
    description: z.string().max(300).default("Built for the phone in your pocket as much as the laptop in the office."),
    items: z.array(cardSchema).max(12).default([
      { icon: "sparkles", title: "AI job analysis", description: "Identifies work activities, quantities and open questions from messages, voice and photos." },
      { icon: "list-checks", title: "Your rates, your prices", description: "Suggestions are matched to your own service catalogue. AI never invents a price." },
      { icon: "file-text", title: "Professional wording", description: "Scope, inclusions, assumptions, exclusions, terms and a follow-up email, all editable." },
      { icon: "calculator", title: "Deterministic pricing", description: "Discounts, call-out fees, tax-inclusive or exclusive totals calculated safely on the server." },
      { icon: "file-down", title: "Branded PDFs", description: "Clean, multi-page PDFs with your logo, colours and payment terms." },
      { icon: "link", title: "Accept online", description: "Customers view, download, accept or decline from a secure link. You are notified instantly." },
      { icon: "bar-chart-3", title: "Analytics", description: "Acceptance rate, value quoted, time to send and more, straight from your data." },
      { icon: "users", title: "Team ready", description: "Invite colleagues, share customers and catalogues, and keep everything in one workspace." },
    ]),
  }),
  "home.beforeAfter": z.object({
    heading: z.string().max(120).default("From a rough message to a quote you are proud to send"),
    label: z.string().max(60).default("Example"),
    before: z.string().max(1200).default("hi mate, need 2 double sockets putting in the front room either side of the fireplace and the hall light changing to one of those LED panel things. fuse box is in the garage. can you do it before the end of the month? cheers, Dave"),
    afterTitle: z.string().max(120).default("Electrical works — living room sockets and hallway lighting"),
    afterLines: z.array(z.string().max(200)).max(8).default([
      "Install 2 × double socket outlets on the existing ring circuit",
      "Replace hallway light fitting with LED panel (customer supplied)",
      "Testing and minor works certificate",
      "Assumes spare capacity on the consumer unit; confirmed on site",
    ]),
  }),
  "home.trades": z.object({
    heading: z.string().max(120).default("Made for local trades and service businesses"),
    description: z.string().max(300).default("QuoteCue ships with editable example catalogues and wording for each trade."),
    items: z.array(tradeSchema).max(16).default([
      { name: "Electricians", icon: "zap", example: "Sockets, lighting, consumer units, EV chargers and certification." },
      { name: "Plumbers", icon: "droplets", example: "Leaks, bathrooms, radiators and outside taps." },
      { name: "Builders", icon: "hammer", example: "Extensions, openings, brickwork and plastering." },
      { name: "Painters and decorators", icon: "paintbrush", example: "Rooms, woodwork, wallpaper and exteriors." },
      { name: "Landscapers", icon: "trees", example: "Fencing, patios, turf and decking." },
      { name: "Joiners and carpenters", icon: "ruler", example: "Doors, kitchens, flooring and bespoke joinery." },
      { name: "Roofers", icon: "home", example: "Repairs, re-roofs, flat roofs and guttering." },
      { name: "Heating engineers", icon: "flame", example: "Boilers, servicing, controls and certificates." },
      { name: "Handymen", icon: "wrench", example: "Small jobs, assembly and repairs." },
      { name: "Cleaning businesses", icon: "sparkles", example: "End-of-tenancy, carpets and commercial cleans." },
      { name: "Property maintenance", icon: "building", example: "Reactive and planned works for landlords and agents." },
    ]),
  }),
  "home.finalCta": z.object({
    heading: z.string().max(120).default("Send your next quote in minutes, not evenings."),
    description: z.string().max(300).default("Start free with three AI quote generations. Upgrade when you are ready."),
    primaryCta: linkSchema.default({ label: "Create my first quote", href: "/signup" }),
    secondaryCta: linkSchema.default({ label: "See pricing", href: "/pricing" }),
  }),
  "pricing.copy": z.object({
    heading: z.string().max(120).default("Simple pricing for every size of business"),
    description: z.string().max(300).default("Start free. Upgrade for more AI generations, branding and team accounts. Annual plans include roughly two months free."),
    footnote: z.string().max(400).default("Prices are in US dollars and exclude any applicable taxes. AI generations count successful analyses and wording generations; failed runs are never charged."),
  }),
  faq: z.object({
    heading: z.string().max(120).default("Frequently asked questions"),
    items: z.array(faqSchema).max(30).default([
      { question: "Does the AI decide my prices?", answer: "No. QuoteCue matches suggested work to your own service catalogue and rates. Anything without a matching item is flagged as unpriced until you approve it. All totals are calculated deterministically on the server." },
      { question: "Can it tell what is wrong from a photograph?", answer: "It can describe what is visible and flag likely issues, but it will never claim a photo proves hidden conditions, compliance, safety or exact measurements. Where appropriate it recommends an on-site inspection." },
      { question: "What counts as an AI generation?", answer: "One successful enquiry analysis or one successful wording generation. Regenerating a single section, transcribing a voice note and failed runs are not charged." },
      { question: "Can my customers accept quotes online?", answer: "Yes. Each quote has a secure link where customers can view, download the PDF, accept by typing their name or decline with an optional reason. You are notified by email." },
      { question: "Do I need a card to start?", answer: "No. The free trial includes three AI quote generations with no card required." },
      { question: "Which currencies and taxes are supported?", answer: "USD, GBP, EUR, CAD, AUD and NZD, with VAT, GST, sales tax, a custom tax label or no tax, and tax-inclusive or tax-exclusive pricing." },
      { question: "Can I invite my team?", answer: "The Pro plan includes up to five users per workspace with shared customers, catalogues and quotes." },
      { question: "Where is my data stored?", answer: "Your data is stored in a PostgreSQL database and private object storage hosted on Railway. Files are only ever served through short-lived signed links." },
    ]),
  }),
  testimonials: z.object({
    heading: z.string().max(120).default("What tradespeople say"),
    items: z.array(testimonialSchema).max(12).default([]),
  }),
  "about.copy": z.object({
    heading: z.string().max(120).default("Built for the trades that keep homes running"),
    body: z
      .string()
      .max(4000)
      .default(
        "QuoteCue AI exists because quoting is the part of the job most trades do at the kitchen table at ten o'clock at night. We built a focused tool that turns the messages, voice notes and photos you already have into a professional quote in minutes, using your own rates and your own words.\n\nQuoteCue is not a chatbot. It is a business tool with clear boundaries: the AI proposes, you decide, and the arithmetic is always done deterministically on the server.",
      ),
  }),
  "contact.copy": z.object({
    heading: z.string().max(120).default("Get in touch"),
    description: z.string().max(400).default("Questions about QuoteCue, pricing or partnerships? Send us a message and we will reply by email."),
  }),
  footer: z.object({
    tagline: z.string().max(160).default("From enquiry to professional quote in minutes."),
    columns: z
      .array(z.object({ heading: z.string().max(40), links: z.array(linkSchema).max(8) }))
      .max(4)
      .default([
        { heading: "Product", links: [{ label: "Features", href: "/features" }, { label: "How it works", href: "/how-it-works" }, { label: "Pricing", href: "/pricing" }, { label: "Templates", href: "/templates" }, { label: "Live demo", href: "/demo" }] },
        { heading: "Company", links: [{ label: "About", href: "/about" }, { label: "Contact", href: "/contact" }, { label: "FAQ", href: "/faq" }] },
        { heading: "Legal", links: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Cookies", href: "/cookies" }] },
      ]),
  }),
  "seo.pages": z.object({
    pages: z
      .array(z.object({ path: z.string().max(80), title: z.string().max(80), description: z.string().max(200) }))
      .max(30)
      .default([
        { path: "/features", title: "Features", description: "AI job analysis, catalogue-matched pricing, branded PDFs and online acceptance for tradespeople." },
        { path: "/how-it-works", title: "How it works", description: "Capture the job, review AI suggestions, price the work and send the quote." },
        { path: "/pricing", title: "Pricing", description: "Free trial, Starter and Pro plans for trades that want to quote faster." },
        { path: "/templates", title: "Trade templates", description: "Editable example catalogues and quote wording for electricians, plumbers, builders and more." },
        { path: "/about", title: "About", description: "Why QuoteCue AI exists and how it treats AI responsibly." },
        { path: "/contact", title: "Contact", description: "Get in touch with the QuoteCue AI team." },
        { path: "/faq", title: "FAQ", description: "Answers to common questions about QuoteCue AI." },
        { path: "/demo", title: "Live demo", description: "Explore QuoteCue AI with sample data, no registration required." },
      ]),
  }),
} as const;

export type MarketingKey = keyof typeof marketingSchemas;
export type MarketingValue<K extends MarketingKey> = z.infer<(typeof marketingSchemas)[K]>;
export type MarketingContentMap = { [K in MarketingKey]: MarketingValue<K> };

export const MARKETING_KEY_LABELS: Record<MarketingKey, string> = {
  "home.hero": "Homepage hero",
  "home.inputs": "Supported inputs",
  "home.howItWorks": "How it works",
  "home.features": "Feature cards",
  "home.beforeAfter": "Before and after example",
  "home.trades": "Supported trades",
  "home.finalCta": "Final call to action",
  "pricing.copy": "Pricing page copy",
  faq: "FAQ",
  testimonials: "Testimonials",
  "about.copy": "About page",
  "contact.copy": "Contact page",
  footer: "Footer",
  "seo.pages": "Page SEO titles and descriptions",
};

export function marketingDefault<K extends MarketingKey>(key: K): MarketingValue<K> {
  return marketingSchemas[key].parse({}) as MarketingValue<K>;
}

let cache: { value: MarketingContentMap; expiresAt: number } | null = null;

export function invalidateMarketingCache(): void {
  cache = null;
}

export async function getMarketingContent(): Promise<MarketingContentMap> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const rows = await prisma.marketingContent.findMany();
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(marketingSchemas) as MarketingKey[]) out[key] = marketingDefault(key);
  for (const row of rows) {
    const key = row.key as MarketingKey;
    const schema = marketingSchemas[key];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) out[key] = parsed.data;
  }
  cache = { value: out as MarketingContentMap, expiresAt: Date.now() + 15_000 };
  return cache.value;
}

export async function getMarketingSection<K extends MarketingKey>(key: K): Promise<MarketingValue<K>> {
  const all = await getMarketingContent();
  return all[key];
}
