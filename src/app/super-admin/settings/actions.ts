"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/utils/result";
import type { SettingKey } from "@/lib/config/site-settings";
import { adminAction } from "../_lib/admin";
import { applySettingValues, isSettingKey } from "../_lib/apply";
import { settingValueFromForm } from "../_lib/settings-fields";

/** Saves a group of site settings. The hidden `keys` field lists the setting keys included in the form. */
export async function saveSettingsAction(_prev: ActionResult<{ changed: string[] }> | null, formData: FormData): Promise<ActionResult<{ changed: string[] }>> {
  return adminAction<{ changed: string[] }>(async (admin) => {
    const keys = String(formData.get("keys") ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length === 0) return fail("No settings were submitted.");
    const unknown = keys.filter((k) => !isSettingKey(k));
    if (unknown.length > 0) return fail(`Unknown setting${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
    const entries = (keys as SettingKey[]).map((key) => ({ key, value: settingValueFromForm(key, formData) }));
    const result = await applySettingValues(admin, entries, "setting.update");
    const returnPath = String(formData.get("returnPath") ?? "");
    if (returnPath.startsWith("/super-admin/")) revalidatePath(returnPath);
    return result;
  });
}
