import Link from "next/link";
import type { MarketingValue } from "@/lib/config/marketing-content";
import type { SiteSettings } from "@/lib/config/site-settings";
import { BrandLogo } from "./brand-logo";
import { Container } from "./section";

const SOCIAL_LABELS: Record<keyof SiteSettings["branding.socialLinks"], string> = {
  x: "X",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function SiteFooter({ settings, footer }: { settings: SiteSettings; footer: MarketingValue<"footer"> }) {
  const productName = settings["branding.productName"];
  const companyName = settings["branding.companyName"];
  const address = settings["branding.companyAddress"].trim();
  const social = Object.entries(settings["branding.socialLinks"]).filter(([, href]) => href && href.trim().length > 0) as Array<[keyof SiteSettings["branding.socialLinks"], string]>;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-navy-950 text-navy-100">
      <Container className="py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:gap-8">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-md" aria-label={`${productName} home`}>
              <BrandLogo productName={productName} logoObjectId={settings["branding.logoObjectId"]} surface="dark" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-navy-200">{footer.tagline}</p>
            <p className="mt-4 text-sm text-navy-300">
              <a href={`mailto:${settings["branding.supportEmail"]}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-white hover:underline">
                {settings["branding.supportEmail"]}
              </a>
            </p>
            {social.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Social links">
                {social.map(([key, href]) => (
                  <li key={key}>
                    <a href={href} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-11 items-center text-sm font-medium text-navy-200 hover:text-white">
                      {SOCIAL_LABELS[key]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {footer.columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">{column.heading}</h2>
              <ul className="mt-4 space-y-1">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    {isExternal(link.href) ? (
                      <a href={link.href} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-10 items-center text-sm text-navy-200 hover:text-white">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="inline-flex min-h-10 items-center text-sm text-navy-200 hover:text-white">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-navy-300 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {companyName}. All rights reserved.
          </p>
          {address ? <p className="whitespace-pre-line">{address}</p> : null}
        </div>
      </Container>
    </footer>
  );
}
