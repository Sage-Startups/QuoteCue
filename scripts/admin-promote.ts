import "dotenv/config";
import { prisma, disconnectPrisma } from "../src/lib/db";

/**
 * Promotes an existing user to super admin.
 * Usage: pnpm admin:promote --email someone@example.com [--role SUPPORT_ADMIN|SUPER_ADMIN|USER]
 */
async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf("--email");
  const roleIdx = args.indexOf("--role");
  const email = emailIdx >= 0 ? args[emailIdx + 1]?.toLowerCase() : undefined;
  const role = (roleIdx >= 0 ? args[roleIdx + 1] : "SUPER_ADMIN") as "SUPER_ADMIN" | "SUPPORT_ADMIN" | "USER";
  if (!email) {
    console.error("Usage: pnpm admin:promote --email someone@example.com [--role SUPER_ADMIN|SUPPORT_ADMIN|USER]");
    process.exit(1);
  }
  if (!["SUPER_ADMIN", "SUPPORT_ADMIN", "USER"].includes(role)) {
    console.error("Role must be SUPER_ADMIN, SUPPORT_ADMIN or USER");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, platformRole: true, emailVerified: true } });
  if (!user) {
    console.error(`No account exists for ${email}. Ask them to register first, then run this command again.`);
    process.exit(1);
  }
  if (!user.emailVerified) {
    console.warn(`Warning: ${email} has not verified their email address yet.`);
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { platformRole: role } }),
    prisma.adminAuditLog.create({
      data: { action: "admin.promote", targetType: "user", targetId: user.id, actorEmail: "cli", previousValue: { platformRole: user.platformRole }, newValue: { platformRole: role }, reason: "pnpm admin:promote" },
    }),
  ]);
  console.log(`${email} is now ${role}. The change is recorded in the audit log.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
