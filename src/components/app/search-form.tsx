"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface FilterOption {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
}

/** Search box plus select filters that update the URL query string. */
export function SearchForm({ placeholder = "Search…", query, filters = [] }: { placeholder?: string; query?: string; filters?: FilterOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <form
      role="search"
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
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
        startTransition(() => router.push(`${pathname}?${sp.toString()}`));
      }}
    >
      <div className="relative flex-1 sm:min-w-[16rem]">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="q" name="q" defaultValue={query} placeholder={placeholder} className="pl-9" type="search" />
      </div>
      {filters.map((f) => (
        <div key={f.name} className="sm:w-44">
          <label htmlFor={`filter-${f.name}`} className="mb-1 block text-xs font-medium text-muted-foreground">
            {f.label}
          </label>
          <Select id={`filter-${f.name}`} name={f.name} defaultValue={f.value ?? ""}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <Button type="submit" variant="secondary" loading={pending}>
        Apply
      </Button>
    </form>
  );
}
