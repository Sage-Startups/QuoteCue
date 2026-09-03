"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceAdmin } from "@/lib/auth";
import { businessSettingsSchema, updateBusinessSettings, setWorkspaceLogo } from "@/lib/services/workspace";
import { assertFeature } from "@/lib/billing/entitlements";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors, formDataToObject } from "@/lib/utils/zod-form";

export async function saveBusinessSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWorkspaceAdmin();
    const raw = formDataToObject(formData);
    const parsed = businessSettingsSchema.safeParse(raw);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await updateBusinessSettings(ctx.workspace.id, parsed.data);
    const logo = String(formData.get("logoObjectId") ?? "");
    const previous = String(formData.get("previousLogoObjectId") ?? "");
    if (logo !== previous) {
      if (logo) await assertFeature(ctx.workspace.id, "CUSTOM_LOGO");
      await setWorkspaceLogo(ctx.workspace.id, logo || null);
    }
    revalidatePath("/app/settings");
    revalidatePath("/app", "layout");
    return ok(undefined, "Business settings saved");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
