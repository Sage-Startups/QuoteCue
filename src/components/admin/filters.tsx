"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";

/** Checkbox that toggles `?excludeDemo=0|1` in the URL (default excludes demo data). */
export function ExcludeDemoToggle({ excluded }: { excluded: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Checkbox
        id="exclude-demo"
        checked={excluded}
        disabled={pending}
        onCheckedChange={(checked) => {
          const sp = new URLSearchParams(params.toString());
          sp.delete("page");
          if (checked === true) sp.delete("excludeDemo");
          else sp.set("excludeDemo", "0");
          start(() => router.push(`${pathname}?${sp.toString()}`));
        }}
      />
      <span>Exclude demo workspace data</span>
    </label>
  );
}
