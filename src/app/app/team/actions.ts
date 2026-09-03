"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { inviteSchema, inviteMember, revokeInvite, removeMember, changeMemberRole } from "@/lib/services/team";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";

export async function inviteMemberAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWorkspaceAdmin();
    const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await enforceRateLimit("invite", ctx.workspace.id);
    const outcome = await inviteMember({ workspaceId: ctx.workspace.id, workspaceName: ctx.workspace.name, inviterId: ctx.user.id, inviterName: ctx.user.name, email: parsed.data.email, role: parsed.data.role });
    revalidatePath("/app/team");
    return ok(undefined, outcome.previewMode ? "Invitation created. Email preview mode is on, so open it from Email previews." : `Invitation sent to ${parsed.data.email}.`);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function revokeInviteAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWorkspaceAdmin();
    await revokeInvite(ctx.workspace.id, String(formData.get("id")));
    revalidatePath("/app/team");
    return ok(undefined, "Invitation revoked");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function removeMemberAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWorkspaceAdmin();
    await removeMember(ctx.workspace.id, String(formData.get("userId")), ctx.user.id);
    revalidatePath("/app/team");
    return ok(undefined, "Member removed");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function changeRoleAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWorkspaceAdmin();
    const role = String(formData.get("role")) === "ADMIN" ? "ADMIN" : "MEMBER";
    await changeMemberRole(ctx.workspace.id, String(formData.get("userId")), role);
    revalidatePath("/app/team");
    return ok(undefined, "Role updated");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
