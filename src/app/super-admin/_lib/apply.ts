import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { SessionContext } from "@/lib/auth";
import { getSiteSettings, invalidateSiteSettingsCache, parseSettingValue, settingSchemas, type SettingKey } from "@/lib/config/site-settings";
import { FEATURE_FLAGS, getFeatureFlags, invalidateFeatureFlagCache, type FeatureFlagKey } from "@/lib/config/feature-flags";
import { getMarketingContent, invalidateMarketingCache, marketingSchemas, type MarketingKey } from "@/lib/config/marketing-content";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { adminAudit } from "./admin";

/**
 * Shared "apply" helpers used by the settings, branding, prompts, feature-flag
 * and marketing actions as well as by audit-log rollbacks. They validate,
 * persist, audit and invalidate caches. Never expose these as server actions.
 */

export function isSettingKey(key: string): key is SettingKey {
  return key in settingSchemas;
}

export function isFlagKey(key: string): key is FeatureFlagKey {
  return key in FEATURE_FLAGS;
}

export function isMarketingKey(key: string): key is MarketingKey {
  return key in marketingSchemas;
}

export async function applySettingValues(admin: SessionContext, entries: Array<{ key: SettingKey; value: unknown }>, action: string, reason?: string): Promise<ActionResult<{ changed: SettingKey[] }>> {
  const current = await getSiteSettings();
  const fieldErrors: Record<string, string[]> = {};
  const validated: Array<{ key: SettingKey; value: unknown }> = [];
  for (const entry of entries) {
    try {
      validated.push({ key: entry.key, value: parseSettingValue(entry.key, entry.value) });
    } catch (error) {
      const message = error && typeof error === "object" && "issues" in error ? Object.values(zodFieldErrors(error as never)).flat().join("; ") : (error as Error).message;
      fieldErrors[entry.key] = [message || "Invalid value"];
    }
  }
  if (Object.keys(fieldErrors).length > 0) return fail("Some settings are invalid.", fieldErrors);
  const changed: SettingKey[] = [];
  for (const { key, value } of validated) {
    const previous = current[key];
    if (JSON.stringify(previous) === JSON.stringify(value)) continue;
    const json = JSON.parse(JSON.stringify(value ?? null));
    await prisma.siteSetting.upsert({ where: { key }, create: { key, value: json, updatedById: admin.user.id }, update: { value: json, updatedById: admin.user.id } });
    await adminAudit(admin, { action, targetType: "setting", targetId: key, reason, previousValue: previous ?? null, newValue: value ?? null });
    changed.push(key);
  }
  if (changed.length > 0) {
    invalidateSiteSettingsCache();
    revalidatePath("/", "layout");
  }
  return ok({ changed }, changed.length === 0 ? "No changes to save." : `${changed.length} setting${changed.length === 1 ? "" : "s"} updated.`);
}

export async function applyFeatureFlag(admin: SessionContext, key: FeatureFlagKey, enabled: boolean, action: string, reason?: string): Promise<ActionResult> {
  const flags = await getFeatureFlags();
  const previous = flags[key];
  const def = FEATURE_FLAGS[key];
  await prisma.featureFlag.upsert({ where: { key }, create: { key, name: def.name, description: def.description, enabled, updatedById: admin.user.id }, update: { enabled, updatedById: admin.user.id } });
  await adminAudit(admin, { action, targetType: "feature_flag", targetId: key, reason, previousValue: { enabled: previous }, newValue: { enabled } });
  invalidateFeatureFlagCache();
  revalidatePath("/", "layout");
  revalidatePath("/super-admin/feature-flags");
  return ok(undefined, `${def.name} ${enabled ? "enabled" : "disabled"}.`);
}

export async function applyMarketingValue(admin: SessionContext, key: MarketingKey, value: unknown, action: string, reason?: string): Promise<ActionResult> {
  const parsed = marketingSchemas[key].safeParse(value);
  if (!parsed.success) return fail("The content did not pass validation.", zodFieldErrors(parsed.error));
  const current = (await getMarketingContent())[key];
  const data = JSON.parse(JSON.stringify(parsed.data));
  await prisma.marketingContent.upsert({ where: { key }, create: { key, value: data, updatedById: admin.user.id }, update: { value: data, updatedById: admin.user.id } });
  await adminAudit(admin, { action, targetType: "marketing_content", targetId: key, reason, previousValue: current, newValue: parsed.data });
  invalidateMarketingCache();
  revalidatePath("/", "layout");
  revalidatePath("/super-admin/marketing");
  revalidatePath(`/super-admin/marketing/${key}`);
  return ok(undefined, "Content saved and published.");
}
