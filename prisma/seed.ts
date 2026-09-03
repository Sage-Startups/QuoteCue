import "dotenv/config";
import { prisma, disconnectPrisma } from "../src/lib/db";
import { seedPlatform } from "../src/lib/seed/platform";
import { seedDemoWorkspace } from "../src/lib/seed/demo";

async function main() {
  const log = (m: string) => console.log(`[seed] ${m}`);
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
      log(`SUPER_ADMIN_EMAIL ${superAdmin} has no account yet; register first, then run pnpm admin:promote --email ${superAdmin}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
