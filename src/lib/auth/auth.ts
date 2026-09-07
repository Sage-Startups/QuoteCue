import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { trackEvent } from "@/lib/services/app-events";

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
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
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
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      const outcome = await sendEmail({
        kind: "VERIFY_EMAIL",
        to: user.email,
        userId: user.id,
        variables: { name: user.name || "there", verifyUrl: url },
      });
      warnIfUndelivered("verification", user.email, outcome);
    },
    afterEmailVerification: async (user) => {
      await trackEvent({ name: "email_verified", userId: user.id });
      await sendEmail({
        kind: "WELCOME",
        to: user.email,
        userId: user.id,
        variables: { name: user.name || "there", dashboardUrl: `${env.APP_URL}/app` },
      });
    },
  },
  user: {
    deleteUser: { enabled: false },
  },
  databaseHooks: {
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
