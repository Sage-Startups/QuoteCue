"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, LogOut, ShieldCheck, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/misc";
import { ADMIN_NAV, type AdminNavItem } from "./admin-nav";

export interface AdminShellProps {
  user: { name: string; email: string; image: string | null };
  environment: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

function isActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-0.5">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              active ? "bg-white/10 text-white" : "text-navy-100/80 hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ user, environment, signOutAction, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const current = ADMIN_NAV.find((i) => isActive(pathname, i));

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex items-center gap-2 px-4 py-5">
        <Link href="/super-admin" onClick={onNavigate} className="inline-flex items-center gap-2" aria-label="Super admin home">
          <Image src="/brand/logo-dark.svg" alt="QuoteCue AI" width={160} height={40} className="h-8 w-auto" priority />
        </Link>
      </div>
      <div className="px-3">
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200">
          <ShieldCheck className="size-4" aria-hidden="true" /> Super admin · {environment}
        </div>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto px-3 scrollbar-thin">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/10 p-3">
        <Link href="/app" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-navy-100/80 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-ring">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to the app
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">{sidebar()}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 p-0">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              {sidebar(() => setOpen(false))}
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Badge variant="accent" className="shrink-0">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Super admin
            </Badge>
            <p className="truncate text-sm font-semibold lg:hidden">{current?.label ?? "Admin"}</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
            <Link href="/app">Open app</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Avatar name={user.name} src={user.image} size="sm" />
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-semibold leading-tight">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out">
                <LogOut />
              </Button>
            </form>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-5 md:px-6 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
