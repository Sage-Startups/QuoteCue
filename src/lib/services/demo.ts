import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { DEMO_WORKSPACE_SLUG } from "@/lib/seed/demo";

/** Loads the demo workspace. Returns null when demo mode is disabled or not seeded. */
export async function getDemoWorkspace() {
  if (!getEnv().DEMO_MODE) return null;
  return prisma.workspace.findFirst({ where: { slug: DEMO_WORKSPACE_SLUG, isDemo: true, deletedAt: null }, include: { settings: true, owner: { select: { id: true, name: true } } } });
}
