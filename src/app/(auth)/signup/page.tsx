import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/misc";
import { getSessionContext } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getPublicPlans } from "@/components/marketing/plans";
import { formatMoney } from "@/lib/utils/money";

export const metadata: Metadata = { title: "Create your account", description: "Start your free QuoteCue AI trial: three AI quote generations, no card required." };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const session = await getSessionContext();
  if (session) redirect("/app");
  const [settings, allPlans, params] = await Promise.all([getSiteSettings(), getPublicPlans(), searchParams]);
  // The pricing page links here as /signup?plan=pro&interval=annual.
  const subscriptionPlans = allPlans.filter((plan) => plan.kind === "SUBSCRIPTION");
  const requested = (params.plan ?? "").toUpperCase();
  const defaultPlan = subscriptionPlans.some((plan) => plan.key === requested) ? requested : "FREE";
  const defaultInterval = params.interval === "annual" ? "annual" : "monthly";
  const plans = subscriptionPlans.map((plan) => ({
    key: plan.key,
    name: plan.name,
    description: plan.description,
    free: plan.monthlyPriceMinor === 0 && plan.annualPriceMinor === 0,
    monthlyLabel: plan.monthlyPriceMinor === 0 ? "Free" : `${formatMoney(plan.monthlyPriceMinor, "USD")}/month`,
    annualLabel: plan.annualPriceMinor === 0 ? "Free" : `${formatMoney(plan.annualPriceMinor, "USD")}/year`,
  }));
  return (
    <AuthCard
      title="Create your account"
      description={`Free trial with ${settings["app.trialCredits"]} AI quote generations. No card required.`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      {!settings["app.registrationEnabled"] ? <Alert variant="warning">Registration is currently closed.</Alert> : <SignUpForm plans={plans} defaultPlan={defaultPlan} defaultInterval={defaultInterval} />}
    </AuthCard>
  );
}
