"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth/auth";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteUserAccount, requireNotLastSuperAdmin } from "@/lib/services/account";
import { recordAudit } from "@/lib/services/audit";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";

const profileSchema = z.object({ name: z.string().trim().min(2).max(80), locale: z.enum(["en-GB", "en-US", "en-AU", "en-CA", "en-NZ", "en-IE"]).default("en-GB") });

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await prisma.user.update({ where: { id: session.user.id }, data: { name: parsed.data.name, locale: parsed.data.locale } });
    revalidatePath("/app", "layout");
    return ok(undefined, "Profile updated");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const passwordSchema = z.object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: z.string().min(10, "Use at least 10 characters").max(128), confirm: z.string() });

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    if (parsed.data.newPassword !== parsed.data.confirm) return fail("Passwords do not match.", { confirm: ["Passwords do not match"] });
    await auth.api.changePassword({ body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true }, headers: await headers() });
    return ok(undefined, "Password changed. Other sessions have been signed out.");
  } catch (error) {
    if (error instanceof APIError) return fail(error.body?.code === "INVALID_PASSWORD" ? "Your current password is incorrect." : "Could not change the password.");
    return fail(toUserMessage(error));
  }
}

export async function revokeSessionAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const token = String(formData.get("token") ?? "");
    if (token === session.sessionToken) return fail("Use sign out to end your current session.");
    await auth.api.revokeSession({ body: { token }, headers: await headers() });
    revalidatePath("/app/account");
    return ok(undefined, "Session revoked");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  try {
    await requireSession();
    await auth.api.revokeOtherSessions({ headers: await headers() });
    revalidatePath("/app/account");
    return ok(undefined, "All other sessions have been signed out");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function deleteAccountAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  try {
    if (String(formData.get("confirm")) !== "DELETE") return fail("Type DELETE to confirm.");
    await requireNotLastSuperAdmin(session.user.id);
    await recordAudit({ actorUserId: session.user.id, actorEmail: session.user.email, action: "account.delete.self", targetType: "user", targetId: session.user.id });
    await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
    await deleteUserAccount(session.user.id);
  } catch (error) {
    return fail(toUserMessage(error));
  }
  redirect("/?deleted=1");
}
