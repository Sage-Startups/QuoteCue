"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface NavLink {
  label: string;
  href: string;
}

export function MobileNav({ links, productName, signInLabel, ctaLabel, ctaHref, signInHref }: { links: NavLink[]; productName: string; signInLabel: string; signInHref: string; ctaLabel: string; ctaHref: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" aria-describedby="mobile-nav-description">
        <SheetTitle className="px-5 pt-5 text-base font-semibold">{productName}</SheetTitle>
        <SheetDescription id="mobile-nav-description" className="sr-only">
          Site navigation
        </SheetDescription>
        <nav aria-label="Mobile" className="mt-4 flex flex-1 flex-col px-3">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground hover:bg-muted"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2 border-t py-5">
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={signInHref} onClick={() => setOpen(false)}>
                {signInLabel}
              </Link>
            </Button>
            <Button asChild variant="accent" size="lg" className="w-full">
              <Link href={ctaHref} onClick={() => setOpen(false)}>
                {ctaLabel}
              </Link>
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
