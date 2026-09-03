"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/demo", label: "Dashboard", exact: true },
  { href: "/demo/new-quote", label: "Create a quote" },
  { href: "/demo/quotes", label: "Quotes" },
  { href: "/demo/customers", label: "Customers" },
];

export function DemoNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Demo sections" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("inline-block rounded-md px-3 py-1.5 text-sm font-semibold", active ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
