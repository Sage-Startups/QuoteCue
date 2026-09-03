import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDemoWorkspace } from "@/lib/services/demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNav } from "@/components/demo/demo-nav";
import { DemoResetButton } from "@/components/demo/reset-button";

export const metadata: Metadata = { title: "Live demo", description: "Explore QuoteCue AI with sample data. No registration required.", robots: { index: true, follow: false } };

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const demo = await getDemoWorkspace();
  if (!demo) notFound();
  return (
    <div className="min-h-dvh bg-background">
      <div role="status" className="bg-navy-900 px-4 py-2 text-center text-xs font-semibold text-white">
        Interactive demo — sample data only. Everything you see belongs to the fictional business &ldquo;{demo.name}&rdquo;. Figures are demonstration data.
      </div>
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="QuoteCue AI home">
            <Image src="/brand/logo-light.svg" alt="QuoteCue AI" width={150} height={36} className="h-8 w-auto" />
          </Link>
          <Badge variant="accent">Demo</Badge>
          <div className="ml-auto flex items-center gap-2">
            <DemoResetButton />
            <Button asChild size="sm" variant="accent">
              <Link href="/signup">Create my first quote</Link>
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <DemoNav />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground">
        This demo uses the mock AI provider and never sends email. Ready to try it with your own jobs?{" "}
        <Link href="/signup" className="font-semibold underline">
          Start free
        </Link>
        .
      </footer>
    </div>
  );
}
