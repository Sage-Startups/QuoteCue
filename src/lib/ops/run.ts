import { prisma } from "@/lib/db";
import { getEnv, missingStorageCredentials } from "@/lib/env";
import { getStorage } from "@/lib/storage";

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
  storage-check              Upload, read and delete a test object to prove the bucket works
  storage-cors [origin]      Allow browser uploads from this site (defaults to APP_URL)
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


/** Proves the bucket credentials and connectivity with a real round trip. */
async function storageCheck(): Promise<void> {
  const env = getEnv();
  const missing = missingStorageCredentials(env);
  if (missing.length > 0) throw new Error(`Object storage is not configured: set ${missing.join(", ")} and redeploy.`);
  const storage = getStorage();
  const key = `diagnostics/ops-check-${Date.now()}.txt`;
  const body = Buffer.from("QuoteCue storage check");
  console.log(`Bucket   ${env.STORAGE_BUCKET}`);
  console.log(`Endpoint ${env.STORAGE_ENDPOINT}`);
  await storage.putObject(key, body, "text/plain");
  console.log("  write   ok");
  const head = await storage.headObject(key);
  console.log(`  read    ok (${head?.sizeBytes ?? 0} bytes)`);
  await storage.deleteObject(key);
  console.log("  delete  ok");
  console.log("\nThe bucket accepts writes from the server. If uploads still fail in the browser, it is the CORS policy: run `ops storage-cors`.");
}

/** Applies the CORS policy that presigned browser uploads require. */
async function storageCors(originArg?: string): Promise<void> {
  const env = getEnv();
  const missing = missingStorageCredentials(env);
  if (missing.length > 0) throw new Error(`Object storage is not configured: set ${missing.join(", ")} and redeploy.`);
  const origin = (originArg ?? env.APP_URL).replace(/\/$/, "");
  if (!/^https?:\/\//.test(origin)) throw new Error(`Origin must start with http:// or https:// - got "${origin}"`);
  const storage = getStorage();
  if (!("putCorsPolicy" in storage) || typeof (storage as { putCorsPolicy?: unknown }).putCorsPolicy !== "function") {
    throw new Error("The configured storage provider does not support CORS configuration.");
  }
  const bucket = storage as unknown as { putCorsPolicy(origins: string[]): Promise<void>; getCorsPolicy(): Promise<Array<{ origins: string[]; methods: string[] }>> };
  console.log(`Allowing browser uploads from ${origin} ...`);
  try {
    await bucket.putCorsPolicy([origin]);
  } catch (error) {
    // Some providers only accept CORS through their own dashboard.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`The bucket refused the CORS policy: ${message}\n\nSet it in your storage provider's dashboard instead. Allow origin ${origin}, methods GET, PUT and HEAD, all request headers, and expose ETag.`);
  }
  const rules = await bucket.getCorsPolicy().catch(() => []);
  if (rules.length > 0) {
    for (const rule of rules) console.log(`  applied: ${rule.methods.join(", ")} from ${rule.origins.join(", ")}`);
  } else {
    console.log("  applied (the bucket did not return the policy for confirmation)");
  }
  console.log("\nUploads from the browser should now work. Try adding a photo to a quote.");
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
    case "storage-check":
      return storageCheck();
    case "storage-cors":
      return storageCors(args[0]);
    default:
      console.log(USAGE);
      if (command) throw new Error(`Unknown command: ${command}`);
  }
}
