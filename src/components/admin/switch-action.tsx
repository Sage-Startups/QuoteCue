"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/utils/result";

/** A Switch bound to a server action. Sends `hidden` fields plus `enabled=true|false`. */
export function SwitchAction({ action, hidden, checked, label, disabled }: { action: (formData: FormData) => Promise<ActionResult<unknown>>; hidden: Record<string, string>; checked: boolean; label: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(checked);
  return (
    <Switch
      aria-label={label}
      checked={optimistic}
      disabled={disabled || pending}
      onCheckedChange={(next) => {
        start(async () => {
          setOptimistic(next);
          const fd = new FormData();
          for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
          fd.set("enabled", next ? "true" : "false");
          const result = await action(fd);
          if (result.ok) toast.success(result.message ?? "Updated");
          else toast.error(result.error);
          router.refresh();
        });
      }}
    />
  );
}
