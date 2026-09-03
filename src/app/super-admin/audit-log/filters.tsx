"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function AuditFilters({ values, targetTypes }: { values: { action?: string; actor?: string; targetType?: string; from?: string; to?: string }; targetTypes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <form
      role="search"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const sp = new URLSearchParams(params.toString());
        sp.delete("page");
        for (const [k, v] of fd.entries()) {
          const value = String(v);
          if (value) sp.set(k, value);
          else sp.delete(k);
        }
        start(() => router.push(`${pathname}?${sp.toString()}`));
      }}
    >
      <div>
        <label htmlFor="f-action" className="mb-1 block text-xs font-medium text-muted-foreground">
          Action contains
        </label>
        <Input id="f-action" name="action" defaultValue={values.action} placeholder="e.g. user.suspend" />
      </div>
      <div>
        <label htmlFor="f-actor" className="mb-1 block text-xs font-medium text-muted-foreground">
          Actor email contains
        </label>
        <Input id="f-actor" name="actor" defaultValue={values.actor} />
      </div>
      <div>
        <label htmlFor="f-target" className="mb-1 block text-xs font-medium text-muted-foreground">
          Target type
        </label>
        <Select id="f-target" name="targetType" defaultValue={values.targetType ?? ""}>
          <option value="">All</option>
          {targetTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="f-from" className="mb-1 block text-xs font-medium text-muted-foreground">
          From
        </label>
        <Input id="f-from" name="from" type="date" defaultValue={values.from} />
      </div>
      <div>
        <label htmlFor="f-to" className="mb-1 block text-xs font-medium text-muted-foreground">
          To
        </label>
        <Input id="f-to" name="to" type="date" defaultValue={values.to} />
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" loading={pending} className="w-full">
          Apply
        </Button>
      </div>
    </form>
  );
}
