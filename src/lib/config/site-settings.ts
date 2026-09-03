import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { settingSchemas, defaultSiteSettings, type SettingKey, type SettingValue, type SiteSettings } from "@/lib/config/site-settings-schema";

export { settingSchemas, settingDefault, defaultSiteSettings, SETTING_DESCRIPTIONS } from "@/lib/config/site-settings-schema";
export type { SettingKey, SettingValue, SiteSettings } from "@/lib/config/site-settings-schema";

interface CacheEntry {
  value: SiteSettings;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 15_000;

export function invalidateSiteSettingsCache(): void {
  cache = null;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const rows = await prisma.siteSetting.findMany();
  const settings = defaultSiteSettings();
  // Environment provides the initial support address until an admin sets one.
  const envSupport = getEnv().SUPPORT_EMAIL;
  if (envSupport && settingSchemas["branding.supportEmail"].safeParse(envSupport).success) settings["branding.supportEmail"] = envSupport;
  for (const row of rows) {
    const key = row.key as SettingKey;
    const schema = settingSchemas[key];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) {
      (settings as Record<string, unknown>)[key] = parsed.data;
    }
  }
  cache = { value: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const all = await getSiteSettings();
  return all[key];
}

export function parseSettingValue<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return settingSchemas[key].parse(value) as SettingValue<K>;
}
