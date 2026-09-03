import type { ReactNode } from "react";
import Link from "next/link";
import { Markdown } from "./markdown";
import { Container } from "./section";

const LEGAL_LINKS = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
  { label: "Cookie policy", href: "/cookies" },
];

export function LegalPage({ title, intro, lastUpdated, source, current, aside }: { title: string; intro?: ReactNode; lastUpdated: string; source: string; current: string; aside?: ReactNode }) {
  return (
    <>
      <div className="border-b bg-white">
        <Container className="py-12 md:py-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Legal</p>
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
          {intro ? <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</p> : null}
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </Container>
      </div>
      <Container className="grid gap-10 py-12 md:grid-cols-[220px_minmax(0,1fr)] md:py-16">
        <aside className="md:sticky md:top-24 md:self-start">
          <nav aria-label="Legal documents">
            <ul className="flex flex-wrap gap-2 md:flex-col md:gap-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={link.href === current ? "page" : undefined}
                    className={
                      link.href === current
                        ? "inline-flex min-h-11 items-center rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white"
                        : "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-white hover:text-foreground"
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {aside ? <div className="mt-6">{aside}</div> : null}
        </aside>
        <article className="max-w-3xl rounded-2xl border bg-white p-6 shadow-card md:p-10">
          <Markdown source={source} headingOffset={0} />
        </article>
      </Container>
    </>
  );
}
