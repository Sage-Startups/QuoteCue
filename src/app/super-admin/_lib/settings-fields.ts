import { settingDefault, settingSchemas, SETTING_DESCRIPTIONS, type SettingKey } from "@/lib/config/site-settings-schema";

/** Input kinds used to render and parse site settings. Safe to import from client components. */
export type SettingKind = "text" | "textarea" | "number" | "boolean" | "color" | "email" | "list" | "currencies" | "object" | "asset";

const KIND_OVERRIDES: Partial<Record<SettingKey, SettingKind>> = {
  "branding.primaryColor": "color",
  "branding.accentColor": "color",
  "branding.supportEmail": "email",
  "email.replyTo": "email",
  "branding.logoObjectId": "asset",
  "branding.faviconObjectId": "asset",
  "branding.socialImageObjectId": "asset",
  "branding.socialLinks": "object",
  "app.taxLabels": "object",
  "app.supportedCurrencies": "currencies",
  "app.maintenanceMessage": "textarea",
  "branding.companyAddress": "textarea",
  "branding.tagline": "textarea",
  "email.footerText": "textarea",
  "seo.defaultDescription": "textarea",
  "announcement.message": "textarea",
};

export const CURRENCY_OPTIONS = ["USD", "GBP", "EUR", "CAD", "AUD", "NZD"] as const;

export function settingKind(key: SettingKey): SettingKind {
  const override = KIND_OVERRIDES[key];
  if (override) return override;
  const def = settingDefault(key) as unknown;
  if (typeof def === "boolean") return "boolean";
  if (typeof def === "number") return "number";
  if (Array.isArray(def)) return "list";
  if (def && typeof def === "object") return "object";
  return "text";
}

export function settingLabel(key: SettingKey): string {
  const last = key.split(".").pop() ?? key;
  return last
    .replace(/ObjectId$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bMb\b/, "(MB)")
    .replace(/\bId\b/, "ID");
}

export interface SettingFieldSpec {
  key: SettingKey;
  label: string;
  description: string;
  kind: SettingKind;
  value: unknown;
  placeholder?: string;
  /** Sub-keys for object kinds. */
  objectKeys?: string[];
}

export function settingKeysWithPrefix(prefix: string): SettingKey[] {
  return (Object.keys(settingSchemas) as SettingKey[]).filter((k) => k.startsWith(`${prefix}.`));
}

export function buildSettingFields(keys: SettingKey[], values: Record<string, unknown>, placeholders: Partial<Record<SettingKey, string>> = {}): SettingFieldSpec[] {
  return keys.map((key) => {
    const kind = settingKind(key);
    const value = values[key];
    return {
      key,
      label: settingLabel(key),
      description: SETTING_DESCRIPTIONS[key],
      kind,
      value,
      placeholder: placeholders[key],
      objectKeys: kind === "object" && value && typeof value === "object" ? Object.keys(value as object) : undefined,
    };
  });
}

/** Reconstructs a raw (unvalidated) setting value from submitted form data. */
export function settingValueFromForm(key: SettingKey, formData: FormData): unknown {
  const kind = settingKind(key);
  switch (kind) {
    case "boolean":
      return formData.get(key) === "on" || formData.get(key) === "true";
    case "number": {
      const raw = String(formData.get(key) ?? "").trim();
      return raw === "" ? undefined : Number(raw);
    }
    case "list":
      return String(formData.get(key) ?? "")
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    case "currencies":
      return formData.getAll(key).map(String);
    case "asset": {
      const raw = String(formData.get(key) ?? "").trim();
      return raw === "" ? null : raw;
    }
    case "object": {
      const defaults = settingDefault(key) as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const sub of Object.keys(defaults)) out[sub] = String(formData.get(`${key}.${sub}`) ?? "").trim();
      return out;
    }
    default:
      return String(formData.get(key) ?? "").trim();
  }
}
