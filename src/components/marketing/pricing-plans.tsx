"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";
import { planSignupHref, type PublicPlan } from "./plans-shared";

type Interval = "monthly" | "annual";

function annualSavingPercent(plan: PublicPlan): number | null {
  if (plan.monthlyPriceMinor <= 0 || plan.annualPriceMinor <= 0) return null;
  const full = plan.monthlyPriceMinor * 12;
  if (plan.annualPriceMinor >= full) return null;
  return Math.round(((full - plan.annualPriceMinor) / full) * 100);
}

export function IntervalToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="inline-flex items-center rounded-full border bg-white p-1 shadow-card">
      <span id={`${id}-label`} className="sr-only">
        Billing interval
      </span>
      {(
        [
          ["monthly", "Monthly"],
          ["annual", "Annual"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "min-h-11 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            value === key ? "bg-navy-900 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function PlanCard({ plan, interval, compact = false }: { plan: PublicPlan; interval: Interval; compact?: boolean }) {
  const isFree = plan.key === "FREE" || (plan.monthlyPriceMinor === 0 && plan.annualPriceMinor === 0);
  const perMonthMinor = interval === "annual" && plan.annualPriceMinor > 0 ? Math.round(plan.annualPriceMinor / 12) : plan.monthlyPriceMinor;
  const saving = annualSavingPercent(plan);
  const bullets = compact ? plan.featureBullets.slice(0, 4) : plan.featureBullets;
  return (
    <article
      aria-labelledby={`plan-${plan.id}-name`}
      className={cn(
        "relative flex flex-col rounded-2xl border bg-white p-6 shadow-card",
        plan.highlight && "border-navy-800 shadow-elevated ring-1 ring-navy-800",
      )}
    >
      {plan.highlight ? (
        <Badge variant="accent" className="absolute -top-3 left-6">
          Most popular
        </Badge>
      ) : null}
      <h3 id={`plan-${plan.id}-name`} className="text-lg font-semibold text-foreground">
        {plan.name}
      </h3>
      {plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}
      <div className="mt-5 flex items-baseline gap-1">
        <span className="tabular text-4xl font-bold tracking-tight text-foreground">{isFree ? formatMoney(0, "USD") : formatMoney(perMonthMinor, "USD")}</span>
        <span className="text-sm text-muted-foreground">/ month</span>
      </div>
      <p className="mt-1 min-h-5 text-xs text-muted-foreground">
        {isFree
          ? "No card required"
          : interval === "annual" && plan.annualPriceMinor > 0
            ? `${formatMoney(plan.annualPriceMinor, "USD")} billed annually${saving ? ` · save ${saving}%` : ""}`
            : "Billed monthly · cancel any time"}
      </p>
      <ul className="mt-6 space-y-2.5 text-sm text-foreground/90">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Button asChild size="lg" variant={plan.highlight ? "accent" : isFree ? "secondary" : "default"} className="w-full">
          <Link href={planSignupHref(plan, interval)}>{isFree ? "Start free" : `Choose ${plan.name}`}</Link>
        </Button>
      </div>
    </article>
  );
}

export function CreditPackCard({ plan }: { plan: PublicPlan }) {
  return (
    <article aria-labelledby={`plan-${plan.id}-name`} className="flex flex-col gap-5 rounded-2xl border border-dashed bg-white p-6 shadow-card md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Add-on</p>
        <h3 id={`plan-${plan.id}-name`} className="mt-1 text-lg font-semibold text-foreground">
          {plan.name}
        </h3>
        {plan.description ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{plan.description}</p> : null}
        {plan.featureBullets.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-foreground/90">
            {plan.featureBullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-1.5">
                <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                {bullet}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
        <p className="tabular text-3xl font-bold tracking-tight text-foreground">
          {formatMoney(plan.oneTimePriceMinor, "USD")} <span className="text-sm font-normal text-muted-foreground">one-off</span>
        </p>
        <Button asChild variant="secondary" size="lg">
          <Link href={planSignupHref(plan)}>Buy from your workspace</Link>
        </Button>
      </div>
    </article>
  );
}

export function PricingPlans({ plans, compact = false, showToggle = true }: { plans: PublicPlan[]; compact?: boolean; showToggle?: boolean }) {
  const [interval, setInterval] = useState<Interval>("monthly");
  const subscriptions = plans.filter((p) => p.kind === "SUBSCRIPTION");
  const packs = plans.filter((p) => p.kind === "CREDIT_PACK");
  return (
    <div>
      {showToggle ? (
        <div className="mb-8 flex justify-center">
          <IntervalToggle value={interval} onChange={setInterval} />
        </div>
      ) : null}
      <div className={cn("grid gap-6", subscriptions.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {subscriptions.map((plan) => (
          <PlanCard key={plan.id} plan={plan} interval={interval} compact={compact} />
        ))}
      </div>
      {!compact && packs.length > 0 ? (
        <div className="mt-6 space-y-6">
          {packs.map((plan) => (
            <CreditPackCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
