"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/utils/result";

export function TradeTemplateForm({ action, trades, SelectComponent }: { action: (fd: FormData) => Promise<ActionResult>; trades: Array<{ slug: string; name: string }>; SelectComponent: React.ComponentType<React.ComponentProps<"select">> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const result = await action(fd);
          if (result.ok) {
            toast.success(result.message ?? "Created");
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      <div className="flex-1">
        <label htmlFor="tradeSlug" className="mb-1 block text-sm font-medium">
          Trade
        </label>
        <SelectComponent id="tradeSlug" name="tradeSlug" defaultValue="electrician">
          {trades.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </SelectComponent>
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Create from trade defaults
      </Button>
    </form>
  );
}
