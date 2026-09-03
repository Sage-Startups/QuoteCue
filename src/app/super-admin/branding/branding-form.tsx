"use client";

import { SettingsForm } from "@/components/admin/settings-form";
import { SiteAssetUpload } from "@/components/admin/site-asset-upload";
import type { SettingFieldSpec } from "../_lib/settings-fields";
import { saveSettingsAction } from "../settings/actions";

const ASSET_HINTS: Record<string, { label: string; hint: string; accept?: string }> = {
  "branding.logoObjectId": { label: "Logo", hint: "PNG, SVG or WebP. Shown in the site header, app and emails." },
  "branding.faviconObjectId": { label: "Favicon", hint: "PNG, ICO or SVG, ideally square.", accept: "image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" },
  "branding.socialImageObjectId": { label: "Social image", hint: "PNG or JPEG, 1200×630 recommended.", accept: "image/png,image/jpeg,image/webp" },
};

export function BrandingForm({ fields }: { fields: SettingFieldSpec[] }) {
  return (
    <SettingsForm
      fields={fields}
      action={saveSettingsAction}
      returnPath="/super-admin/branding"
      submitLabel="Save branding"
      renderAsset={(field) => {
        const meta = ASSET_HINTS[field.key] ?? { label: field.label, hint: "" };
        return <SiteAssetUpload name={field.key} initialObjectId={typeof field.value === "string" ? field.value : null} label={meta.label} hint={meta.hint} accept={meta.accept} />;
      }}
    />
  );
}
