"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WIZARD_STEPS } from "./types";

export function WizardNav({ quoteId, current, maxReached }: { quoteId: string; current: number; maxReached: number }) {
  return (
    <nav aria-label="Quote steps" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ol className="flex min-w-max gap-2 md:min-w-0 md:flex-wrap">
        {WIZARD_STEPS.map((s) => {
          const done = s.step < current || (s.step < maxReached && s.step !== current);
          const reachable = s.step <= Math.max(maxReached, current) && s.step !== 7;
          const classes = cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            s.step === current ? "border-primary bg-primary text-white" : done ? "border-green-200 bg-green-50 text-success" : "border-border bg-white text-muted-foreground",
            !reachable && "opacity-60",
          );
          const content = (
            <>
              {done ? <Check className="size-3" aria-hidden="true" /> : <span>{s.step}</span>}
              <span>{s.short}</span>
            </>
          );
          return (
            <li key={s.key}>
              {reachable && s.step !== current ? (
                <Link href={`/app/quotes/${quoteId}/edit?step=${s.step}`} className={classes}>
                  {content}
                </Link>
              ) : (
                <span className={classes} aria-current={s.step === current ? "step" : undefined}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
