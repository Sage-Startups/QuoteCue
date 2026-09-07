"use server";

import { APIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getSessionContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/config/site-settings";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { trackEvent } from "@/lib/services/app-events";
import { getClientIp } from "@/lib/utils/request";
import { safeRedirectPath } from "@/lib/utils/redirect";
import { normaliseEmail } from "@/lib/utils/strings";
import { PENDING_PLAN_COOKIE } from "@/lib/billing/pending-plan";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";

const GENERIC_RESET_MESSAGE = "If an account exists for that email address, a password reset link is on its way.";
const GENERIC_MAGIC_MESSAGE = "If an account exists for that email address, a sign-in link is on its way.";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  terms: z.literal("on", { error: "Please accept the terms to continue" }),
  plan: z.enum(["FREE", "STARTER", "PRO"]).default("FREE"),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function signUpAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const settings = await getSiteSettings();
  if (!settings["app.registrationEnabled"]) return fail("Registration is currently closed. Please check back soon.");
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await getClientIp();
  const limit = await checkRateLimit("registration", ip ?? "unknown");
  if (!limit.allowed) return fail("Too many sign-up attempts. Please try again later.");
  const email = normaliseEmail(parsed.data.email);
  await trackEvent({ name: "registration_started" });
  try {
    const result = await auth.api.signUpEmail({ body: { name: parsed.data.name, email, password: parsed.data.password }, headers: await headers() });
    await trackEvent({ name: "registration_completed", userId: result.user.id });
    // The workspace does not exist until onboarding finishes, and a subscription
    // belongs to a workspace, so carry the chosen plan until then.
    if (parsed.data.plan !== "FREE") {
      const cookieStore = await cookies();
      cookieStore.set(PENDING_PLAN_COOKIE, `${parsed.data.plan}:${parsed.data.interval}`, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: getEnv().isProduction,
        maxAge: 60 * 60 * 24,
      });
    }
    const env = getEnv();
    await sendEmail({
      kind: "WELCOME",
      to: email,
      userId: result.user.id,
      variables: { name: parsed.data.name, dashboardUrl: `${env.APP_URL}/app` },
    }).catch((error: unknown) => console.error("[auth] welcome email failed", error));
  } catch (error) {
    // Better Auth reports this as status "UNPROCESSABLE_ENTITY" with the code
    // USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL, so match the prefix rather than an
    // exact code: a stricter check fell through to the generic failure message.
    if (error instanceof APIError && (error.body?.code?.startsWith("USER_ALREADY_EXISTS") || error.status === "UNPROCESSABLE_ENTITY" || error.status === 422)) {
      return fail("An account already exists for that email address. Sign in instead, or reset your password.", { email: ["This email address is already registered"] });
    }
    if (error instanceof APIError && error.body?.code === "PASSWORD_TOO_SHORT") return fail("Please use a longer password.", { password: ["Use at least 10 characters"] });
    console.error("[auth] sign-up failed", error);
    return fail("We could not create your account right now. Please try again.");
  }
  // Outside the try: redirect() throws by design and must not be caught above.
  redirect("/onboarding");
}

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export async function signInAction(_prev: ActionResult<{ next: string }> | null, formData: FormData): Promise<ActionResult<{ next: string }>> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await getClientIp();
  const email = normaliseEmail(parsed.data.email);
  const limit = await checkRateLimit("login", `${ip ?? "unknown"}:${email}`);
  if (!limit.allowed) return fail(`Too many sign-in attempts. Please wait ${Math.ceil(limit.retryAfterSeconds / 60)} minutes and try again.`);
  const next = safeRedirectPath(parsed.data.next, "/app");
  try {
    await auth.api.signInEmail({ body: { email, password: parsed.data.password }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === "EMAIL_NOT_VERIFIED") {
        return fail("Please verify your email address first. We have sent you a new verification link.");
      }
      return fail("Incorrect email or password.");
    }
    console.error("[auth] sign-in failed", error);
    return fail("We could not sign you in right now. Please try again.");
  }
  const session = await getSessionContext();
  if (session) await trackEvent({ name: "login", userId: session.user.id });
  return ok({ next });
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

const emailOnlySchema = z.object({ email: z.string().trim().email("Enter a valid email address") });

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await getClientIp();
  const limit = await checkRateLimit("passwordReset", ip ?? "unknown");
  if (!limit.allowed) return fail("Too many requests. Please try again later.");
  const email = normaliseEmail(parsed.data.email);
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
  } catch (error) {
    console.error("[auth] password reset request failed", error);
  }
  return ok(undefined, GENERIC_RESET_MESSAGE);
}

const resetSchema = z.object({
  token: z.string().min(1, "This reset link is invalid"),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  confirm: z.string(),
});

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  if (parsed.data.password !== parsed.data.confirm) return fail("Passwords do not match.", { confirm: ["Passwords do not match"] });
  try {
    await auth.api.resetPassword({ body: { token: parsed.data.token, newPassword: parsed.data.password }, headers: await headers() });
    return ok(undefined, "Your password has been changed. All other sessions have been signed out.");
  } catch (error) {
    if (error instanceof APIError) return fail("This reset link is invalid or has expired. Please request a new one.");
    console.error("[auth] password reset failed", error);
    return fail("We could not reset your password right now. Please try again.");
  }
}

export async function magicLinkAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isFeatureEnabled("magic_link_login"))) return fail("Magic-link sign-in is currently disabled.");
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await getClientIp();
  const limit = await checkRateLimit("magicLink", ip ?? "unknown");
  if (!limit.allowed) return fail("Too many requests. Please try again later.");
  const email = normaliseEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, suspendedAt: true } });
  if (user && !user.suspendedAt) {
    try {
      await auth.api.signInMagicLink({ body: { email, callbackURL: "/app" }, headers: await headers() });
    } catch (error) {
      console.error("[auth] magic link failed", error);
    }
  }
  return ok(undefined, GENERIC_MAGIC_MESSAGE);
}
