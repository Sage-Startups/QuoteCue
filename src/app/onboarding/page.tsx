import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getSessionContext, getWorkspaceContext } from "@/lib/auth";
import { getSiteSettings } from "@/lib/config/site-settings";
import { tradeOptions } from "@/lib/services/workspace";
import { signOutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false } };

export default async function OnboardingPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login?next=/onboarding");
  const ws = await getWorkspaceContext();
  if (ws) redirect("/app");
  const settings = await getSiteSettings();
  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Image src="/brand/logo-light.svg" alt={settings["branding.productName"]} width={170} height={42} className="h-9 w-auto" priority />
        <form action={signOutAction}>
          <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-2 md:pt-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Set up your workspace</h1>
        <p className="mt-1 text-muted-foreground">A few details so your quotes look right from the first one. Takes about two minutes.</p>
        <div className="mt-6 rounded-xl border bg-card p-5 shadow-card md:p-8">
          <OnboardingForm
            defaultName={session.user.name}
            defaultEmail={session.user.email}
            trades={tradeOptions()}
            currencies={settings["app.supportedCurrencies"]}
            defaultCurrency="GBP"
            defaultValidityDays={settings["app.defaultQuoteExpiryDays"]}
            defaultTerms="Payment is due within 14 days of the invoice date. A deposit may be requested before materials are ordered."
            maxLogoMb={settings["app.maxLogoMb"]}
          />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Invited to a team? Open the link in your invitation email, or{" "}
          <Link href="/app/help" className="underline">
            read the help centre
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
