import type { MarketingValue } from "@/lib/config/marketing-content";
import { Section, SectionHeading } from "./section";

/** Renders only testimonials marked as published. Renders nothing when there are none. */
export function Testimonials({ content }: { content: MarketingValue<"testimonials"> }) {
  const items = content.items.filter((t) => t.published === true);
  if (items.length === 0) return null;
  return (
    <Section aria-labelledby="testimonials-heading" tone="muted">
      <SectionHeading id="testimonials-heading" title={content.heading} />
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <li key={`${i}-${t.name}`} className="flex flex-col rounded-2xl border bg-background p-6 shadow-card">
            <blockquote className="flex-1 text-base leading-relaxed text-foreground/90">
              <p>“{t.quote}”</p>
            </blockquote>
            <footer className="mt-5 text-sm">
              <p className="font-semibold text-foreground">{t.name}</p>
              <p className="text-muted-foreground">{t.role}</p>
            </footer>
          </li>
        ))}
      </ul>
    </Section>
  );
}
