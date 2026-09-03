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
      await sendEmail({
        kind: "PASSWORD_RESET",
        to: user.email,
        userId: user.id,
        variables: { name: user.name || "there", resetUrl: url },
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        kind: "VERIFY_EMAIL",
        to: user.email,
        userId: user.id,
        variables: { name: user.name || "there", verifyUrl: url },
      });
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
