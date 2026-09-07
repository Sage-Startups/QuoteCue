import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { DEMO_WORKSPACE_SLUG } from "@/lib/seed/demo";

/** True for links into the public demo. */
export function isDemoPath(href: string): boolean {
  return href === "/demo" || href.startsWith("/demo/");
}

let availability: { checkedAt: number; value: boolean } | null = null;

/**
 * Whether the public demo can actually be opened: DEMO_MODE on and the demo
 * workspace seeded. Marketing pages call this so they never advertise a link
 * that would 404. Cached briefly, like the other configuration lookups.
 */
export async function isDemoAvailable(): Promise<boolean> {
  if (availability && Date.now() - availability.checkedAt < 15_000) return availability.value;
  const value = (await getDemoWorkspace()) !== null;
  availability = { checkedAt: Date.now(), value };
  return value;
}

/** Hides a call to action that points at the demo while the demo is unavailable. */
export function ctaVisible(href: string, demoAvailable: boolean): boolean {
  return demoAvailable || !isDemoPath(href);
}

/** Loads the demo workspace. Returns null when demo mode is disabled or not seeded. */
export async function getDemoWorkspace() {
  if (!getEnv().DEMO_MODE) return null;
  return prisma.workspace.findFirst({ where: { slug: DEMO_WORKSPACE_SLUG, isDemo: true, deletedAt: null }, include: { settings: true, owner: { select: { id: true, name: true } } } });
}
