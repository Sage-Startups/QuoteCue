import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";

const env = getEnv();

/**
 * A verification or reset email that is not delivered locks the account out:
 * the user is told to check an inbox nothing will arrive in. Better Auth
 * ignores the send outcome, so surface it in the logs with the fix.
 */
function warnIfUndelivered(kind: string, to: string, outcome: { status: string; error?: string; previewMode: boolean }): void {
  if (outcome.status === "SENT") return;
  const reason = outcome.previewMode
    ? "the email provider is in preview mode (RESEND_API_KEY is not set), so nothing was delivered"
    : `the provider rejected it: ${outcome.error ?? "unknown error"}`;
  console.error(`[auth] ${kind} email to ${to} was not delivered - ${reason}. Run './docker/entrypoint.sh ops email-status' to inspect, or './docker/entrypoint.sh ops verify-email ${to}' to let this account in.`);
}

export const auth = betterAuth({
  appName: "QuoteCue AI",
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    useSecureCookies: env.isProduction,
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
    cookiePrefix: "quotecue",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
  },
  emailAndPassword: {
    enabled: true,
    // Sign-up admits the account straight away: an unverified account that
    // depends on a delivered email locks people out whenever mail is
    // misconfigured, and the address is confirmed in practice by the password
    // reset flow. Reset emails are still sent.
    requireEmailVerification: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const outcome = await sendEmail({
        kind: "PASSWORD_RESET",
        to: user.email,
        userId: user.id,
        variables: { name: user.name || "there", resetUrl: url },
      });
      warnIfUndelivered("password reset", user.email, outcome);
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, emailVerified: true } }),
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { suspendedAt: true, deletedAt: true },
          });
          if (!user || user.suspendedAt || user.deletedAt) return false;
          await prisma.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } });
          return;
        },
      },
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({ kind: "MAGIC_LINK", to: email, variables: { magicLinkUrl: url } });
      },
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
