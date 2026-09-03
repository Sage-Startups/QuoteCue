import { prisma } from "@/lib/db";
import { seedPlatform } from "@/lib/seed/platform";
import { seedDemoWorkspace } from "@/lib/seed/demo";

/**
 * Seeds platform data (plans, trade templates, AI prompts, email templates,
 * feature flags) and optionally the demo workspace. Idempotent: rows an admin
 * has edited are left alone. Shared by `pnpm db:seed` and the image's `seed`
 * entrypoint so a deployment can be seeded without a local checkout.
 */
export async function runSeed(log: (message: string) => void = (m) => console.log(`[seed] ${m}`)): Promise<void> {
  await seedPlatform({ log });
  const demoEnabled = process.env.DEMO_MODE === "true" || process.env.SEED_DEMO === "true";
  if (demoEnabled) {
    await seedDemoWorkspace({ log });
  } else {
    log("Demo workspace skipped (set DEMO_MODE=true or SEED_DEMO=true to include it)");
  }
  const superAdmin = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();
  if (superAdmin) {
    const user = await prisma.user.findUnique({ where: { email: superAdmin }, select: { id: true, platformRole: true } });
    if (user && user.platformRole !== "SUPER_ADMIN") {
      await prisma.user.update({ where: { id: user.id }, data: { platformRole: "SUPER_ADMIN" } });
      await prisma.adminAuditLog.create({ data: { action: "admin.promote", targetType: "user", targetId: user.id, actorEmail: "seed", newValue: { platformRole: "SUPER_ADMIN" }, reason: "SUPER_ADMIN_EMAIL matched during seed" } });
      log(`Promoted ${superAdmin} to super admin`);
    } else if (!user) {
      log(`SUPER_ADMIN_EMAIL ${superAdmin} has no account yet; register first, then run admin:promote`);
    }
  }
}
