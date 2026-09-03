"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, LogOut, ShieldCheck, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, Progress } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { APP_NAV, MOBILE_PRIMARY_NAV, type NavItem } from "./nav-config";

export interface AppShellProps {
  user: { name: string; email: string; image: string | null; isSuperAdmin: boolean };
  workspace: { name: string; isDemo: boolean };
  isAdmin: boolean;
  isDev: boolean;
  supportMode: { reason: string; expiresAt: string } | null;
  usage: { planName: string; used: number; allowance: number; credits: number; isTrial: boolean };
  signOutAction: () => Promise<void>;
  endSupportAction?: () => Promise<void>;
  children: React.ReactNode;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/app/quotes") return pathname.startsWith("/app/quotes") && pathname !== "/app/quotes/new";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
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

export function AppShell({ user, workspace, isAdmin, isDev, supportMode, usage, signOutAction, endSupportAction, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const items = APP_NAV.filter((i) => (!i.adminOnly || isAdmin) && (!i.devOnly || isDev));
  const available = Math.max(0, usage.allowance - usage.used) + usage.credits;

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex items-center gap-2 px-4 py-5">
        <Link href="/app" onClick={onNavigate} className="inline-flex items-center gap-2" aria-label="QuoteCue home">
          <Image src="/brand/logo-dark.svg" alt="QuoteCue AI" width={160} height={40} className="h-8 w-auto" priority />
        </Link>
      </div>
      <div className="px-3">
        <div className="rounded-lg bg-white/5 px-3 py-2.5">
          <p className="truncate text-sm font-semibold">{workspace.name}</p>
          <p className="text-xs text-navy-100/70">{workspace.isDemo ? "Demo workspace" : usage.planName}</p>
        </div>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto px-3 scrollbar-thin">
        <NavLinks items={items} pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Sparkles className="size-3.5 text-amber-400" aria-hidden="true" /> AI generations
            </span>
            <span className="tabular">{available} left</span>
          </div>
          {usage.allowance > 0 ? <Progress className="mt-2 bg-white/10" value={usage.used} max={usage.allowance} label="AI generations used this period" /> : null}
          <p className="mt-2 text-[11px] text-navy-100/70">
            {usage.allowance > 0 ? `${usage.used} of ${usage.allowance} used this period` : usage.isTrial ? "Free trial credits" : "No monthly allowance"}
            {usage.credits > 0 ? ` · ${usage.credits} extra credit${usage.credits === 1 ? "" : "s"}` : ""}
          </p>
          {isAdmin ? (
            <Button asChild size="sm" variant="accent" className="mt-3 w-full">
              <Link href="/app/billing" onClick={onNavigate}>
                {usage.isTrial ? "Upgrade plan" : "Manage plan"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">{sidebar()}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {supportMode ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-navy-900">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" /> Support mode (read-only): viewing {workspace.name}. Reason: {supportMode.reason}
            </span>
            {endSupportAction ? (
              <form action={endSupportAction}>
                <Button type="submit" size="sm" variant="secondary">
                  End support session
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
        {workspace.isDemo ? (
          <div role="status" className="bg-navy-800 px-4 py-1.5 text-center text-xs font-medium text-white">
            Interactive demo — sample data only. Figures are demonstration data and do not represent real customers.
          </div>
        ) : null}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebar(() => setOpen(false))}
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1 lg:hidden">
            <p className="truncate text-sm font-semibold">{workspace.name}</p>
          </div>
          <div className="hidden flex-1 lg:block" />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/app/quotes/new">New quote</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label="Account menu">
                <Avatar name={user.name} src={user.image} size="sm" />
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/account">Personal account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/help">Help</Link>
              </DropdownMenuItem>
              {user.isSuperAdmin ? (
                <DropdownMenuItem asChild>
                  <Link href="/super-admin">
                    <ShieldCheck /> Super admin
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOutAction()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main id="main" className="flex-1 px-4 py-5 pb-24 md:px-6 md:py-8 lg:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-white/95 backdrop-blur safe-bottom lg:hidden">
          {MOBILE_PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <item.icon className={cn("size-5", item.href === "/app/quotes/new" && "text-accent")} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {workspace.isDemo ? <Badge variant="accent" className="fixed bottom-20 right-4 z-30 shadow-elevated lg:bottom-4">Demo data</Badge> : null}
      </div>
    </div>
  );
}
