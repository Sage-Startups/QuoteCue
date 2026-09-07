import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

/**
 * Operator commands that run inside the container. The equivalents under
 * scripts/ go through tsx, which is a dev dependency and is pruned from the
 * image, so they cannot be used on a deployment. Reached through
 * `./docker/entrypoint.sh ops <command>`.
 */

const USAGE = `Usage: ops <command>

  doctor                     Report which providers are live and flag misconfiguration
  email-status [count]       Recent email attempts with their delivery status and errors
  verify-email <email>       Mark an address verified when the email could not be delivered
  promote <email> [role]     Set a platform role: SUPER_ADMIN (default), SUPPORT_ADMIN, USER
`;

async function doctor(): Promise<void> {
  const env = getEnv();
  const p = env.providers;
  console.log("Providers");
  console.log(`  ai       ${p.ai}${p.ai === "mock" ? "   (no OPENAI_API_KEY: analysis is fake)" : ""}`);
  console.log(`  email    ${p.email}${p.email === "preview" ? "   (no RESEND_API_KEY: nothing is delivered)" : ""}`);
  console.log(`  stripe   ${p.stripe}${p.stripe === "mock" ? "   (no STRIPE_SECRET_KEY: checkout is fake)" : ""}`);
  console.log(`  storage  ${p.storage}${env.storageConfigured ? "" : "   (bucket credentials missing: uploads fail)"}`);
  console.log("");
  console.log("Email");
  console.log(`  EMAIL_FROM  ${env.EMAIL_FROM}`);
  if (/example\.com/i.test(env.EMAIL_FROM)) {
    console.log("  WARNING: EMAIL_FROM still uses example.com. Resend rejects unverified senders, so no email will arrive.");
  }
  console.log(`  APP_URL     ${env.APP_URL}`);
  console.log("");
  const [users, verified, workspaces, plans] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.workspace.count(),
    prisma.plan.count(),
  ]);
  console.log(`Data: ${users} users (${verified} verified), ${workspaces} workspaces, ${plans} plans`);
  if (plans === 0) console.log("  WARNING: no plans. Run `./docker/entrypoint.sh seed`.");
}

async function emailStatus(countArg?: string): Promise<void> {
  const take = Math.min(Math.max(Number(countArg) || 10, 1), 50);
  const rows = await prisma.emailEvent.findMany({ orderBy: { createdAt: "desc" }, take, select: { createdAt: true, kind: true, toEmail: true, status: true, error: true } });
  if (rows.length === 0) {
    console.log("No email has been attempted yet.");
    return;
  }
  for (const row of rows) {
    console.log(`${row.createdAt.toISOString()}  ${row.status.padEnd(7)}  ${row.kind.padEnd(16)}  ${row.toEmail}`);
    if (row.error) console.log(`    error: ${row.error}`);
  }
  const failed = rows.filter((r) => r.status === "FAILED").length;
  const preview = rows.filter((r) => r.status === "PREVIEW").length;
  if (preview > 0) console.log(`\n${preview} of these were never delivered: the email provider is in preview mode (RESEND_API_KEY is not set).`);
  if (failed > 0) console.log(`\n${failed} of these failed at the provider. The error above is what Resend returned.`);
}

async function verifyEmail(email?: string): Promise<void> {
  if (!email) throw new Error("An email address is required: ops verify-email you@example.com");
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, emailVerified: true } });
  if (!user) throw new Error(`No account exists for ${email}. Sign up first, then run this.`);
  if (user.emailVerified) {
    console.log(`${email} is already verified; you can sign in.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  await prisma.adminAuditLog.create({ data: { action: "user.email.verify", targetType: "user", targetId: user.id, actorEmail: "ops-cli", newValue: { emailVerified: true }, reason: "Verified from the container because the verification email could not be delivered" } });
  console.log(`${email} is now verified. Sign in at /login.`);
}

async function promote(email?: string, role = "SUPER_ADMIN"): Promise<void> {
  if (!email) throw new Error("An email address is required: ops promote you@example.com");
  const allowed = ["SUPER_ADMIN", "SUPPORT_ADMIN", "USER"] as const;
  const target = role.toUpperCase() as (typeof allowed)[number];
  if (!allowed.includes(target)) throw new Error(`Role must be one of ${allowed.join(", ")}`);
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, platformRole: true } });
  if (!user) throw new Error(`No account exists for ${email}. Register first, then run this.`);
  await prisma.user.update({ where: { id: user.id }, data: { platformRole: target } });
  await prisma.adminAuditLog.create({ data: { action: "admin.promote", targetType: "user", targetId: user.id, actorEmail: "ops-cli", previousValue: { platformRole: user.platformRole }, newValue: { platformRole: target }, reason: "Set from the container" } });
  console.log(`${email} is now ${target}.`);
}

export async function runOps(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  switch (command) {
    case "doctor":
      return doctor();
    case "email-status":
      return emailStatus(args[0]);
    case "verify-email":
      return verifyEmail(args[0]);
    case "promote":
      return promote(args[0], args[1]);
    default:
      console.log(USAGE);
      if (command) throw new Error(`Unknown command: ${command}`);
  }
}
