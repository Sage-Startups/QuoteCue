"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

const OPTIONS: Array<{ key: string; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "custom", label: "Custom" },
];

export function DateRangeFilter({ current, from, to }: { current: string; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(current === "custom");
  const [fromValue, setFromValue] = useState(from ?? "");
  const [toValue, setToValue] = useState(to ?? "");

  const navigate = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div role="group" aria-label="Date range" className="inline-flex rounded-lg border bg-white p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={current === o.key}
            disabled={pending}
            onClick={() => {
              if (o.key === "custom") setCustomOpen(true);
              else {
                setCustomOpen(false);
                navigate({ range: o.key, from: null, to: null });
              }
            }}
            className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", current === o.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {customOpen ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (fromValue && toValue) navigate({ range: "custom", from: fromValue, to: toValue });
          }}
        >
          <label className="sr-only" htmlFor="range-from">
            From
          </label>
          <Input id="range-from" type="date" value={fromValue} onChange={(e) => setFromValue(e.target.value)} className="h-9 w-[9.5rem] text-xs" required />
          <span className="text-xs text-muted-foreground">to</span>
          <label className="sr-only" htmlFor="range-to">
            To
          </label>
          <Input id="range-to" type="date" value={toValue} onChange={(e) => setToValue(e.target.value)} className="h-9 w-[9.5rem] text-xs" required />
          <Button type="submit" size="sm" loading={pending}>
            Apply
          </Button>
        </form>
      ) : null}
    </div>
  );
}
