import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from "@/lib/config/site-settings";
import { BrandLogo } from "./brand-logo";
import { MobileNav, type NavLink } from "./mobile-nav";
import { Container } from "./section";

export const PRIMARY_NAV: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Templates", href: "/templates" },
  { label: "FAQ", href: "/faq" },
];

const SIGN_IN = { label: "Sign in", href: "/login" };
const CTA = { label: "Create my first quote", href: "/signup" };

export function AnnouncementBanner({ settings }: { settings: SiteSettings }) {
  if (!settings["announcement.enabled"] || !settings["announcement.message"]) return null;
  const linkLabel = settings["announcement.linkLabel"];
  const linkHref = settings["announcement.linkHref"];
  return (
    <div className="bg-navy-900 text-white">
      <Container className="flex min-h-11 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm">
        <p>{settings["announcement.message"]}</p>
        {linkLabel && linkHref ? (
          <Link href={linkHref} className="inline-flex min-h-8 items-center gap-1 font-semibold text-amber-300 underline-offset-4 hover:underline">
            {linkLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </Container>
    </div>
  );
}

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const productName = settings["branding.productName"];
  const registrationEnabled = settings["app.registrationEnabled"];
  const ctaHref = registrationEnabled ? CTA.href : "/login";
  const ctaLabel = registrationEnabled ? CTA.label : "Sign in";
  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-md" aria-label={`${productName} home`}>
          <BrandLogo productName={productName} logoObjectId={settings["branding.logoObjectId"]} priority />
        </Link>
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={SIGN_IN.href} className="hidden min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground/80 hover:text-foreground sm:inline-flex">
            {SIGN_IN.label}
          </Link>
          {registrationEnabled ? (
            <Button asChild variant="accent" className="hidden h-11 sm:inline-flex">
              <Link href={CTA.href}>{CTA.label}</Link>
            </Button>
          ) : null}
          <MobileNav links={PRIMARY_NAV} productName={productName} signInLabel={SIGN_IN.label} signInHref={SIGN_IN.href} ctaLabel={ctaLabel} ctaHref={ctaHref} />
        </div>
      </Container>
    </header>
  );
}
