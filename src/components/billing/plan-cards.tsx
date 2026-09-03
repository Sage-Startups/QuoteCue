"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";

export interface PlanCardData {
  key: string;
  name: string;
  description: string | null;
  monthlyPriceMinor: number;
  annualPriceMinor: number;
  aiGenerationsPerPeriod: number;
  maxMembers: number;
  highlight: boolean;
  featureBullets: string[];
}

export function PlanCards({ plans, currentKey, currentInterval, action, isMock }: { plans: PlanCardData[]; currentKey: string; currentInterval: "MONTH" | "YEAR"; action: (fd: FormData) => Promise<void>; isMock: boolean }) {
  const [interval, setInterval] = useState<"MONTH" | "YEAR">(currentInterval);
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Billing interval" className="inline-flex rounded-lg border bg-white p-0.5">
        {(["MONTH", "YEAR"] as const).map((i) => (
          <button key={i} type="button" aria-pressed={interval === i} onClick={() => setInterval(i)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", interval === i ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>
            {i === "MONTH" ? "Monthly" : "Annual (2 months free)"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const price = interval === "YEAR" ? plan.annualPriceMinor : plan.monthlyPriceMinor;
          const isCurrent = plan.key === currentKey;
          const isFree = plan.key === "FREE";
          return (
            <div key={plan.key} className={cn("flex flex-col rounded-xl border bg-card p-5 shadow-card", plan.highlight && "border-accent ring-1 ring-accent")}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {plan.highlight ? <Badge variant="accent">Most popular</Badge> : null}
                {isCurrent ? <Badge variant="success">Current plan</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-4">
                <span className="text-3xl font-bold tabular">{isFree ? "Free" : formatMoney(price, "USD").replace(/\.00$/, "")}</span>
                {!isFree ? <span className="text-sm text-muted-foreground">/{interval === "YEAR" ? "year" : "month"}</span> : null}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {plan.featureBullets.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                {isFree ? (
                  <Button variant="secondary" className="w-full" disabled>
                    {isCurrent ? "Current plan" : "Included"}
                  </Button>
                ) : (
                  <form action={action}>
                    <input type="hidden" name="plan" value={plan.key} />
                    <input type="hidden" name="interval" value={interval} />
                    <Button type="submit" className="w-full" variant={plan.highlight ? "accent" : "default"} disabled={isCurrent && currentInterval === interval}>
                      {isCurrent ? (currentInterval === interval ? "Current plan" : `Switch to ${interval === "YEAR" ? "annual" : "monthly"}`) : currentKey === "FREE" ? `Upgrade to ${plan.name}` : `Change to ${plan.name}`}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isMock ? <p className="text-xs text-muted-foreground">Billing is in development mock mode (STRIPE_SECRET_KEY not set). Checkout simulates a successful payment.</p> : null}
    </div>
  );
}
