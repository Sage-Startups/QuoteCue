import type { Metadata } from "next";
import { requireSuperAdminForPage } from "@/lib/auth";
import { getSiteSettings } from "@/lib/config/site-settings";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buildSettingFields, settingKeysWithPrefix } from "../_lib/settings-fields";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Branding" };

export default async function BrandingPage() {
  await requireSuperAdminForPage("/super-admin/branding");
  const settings = await getSiteSettings();
  const brandingKeys = settingKeysWithPrefix("branding");
  const assetKeys = brandingKeys.filter((k) => k.endsWith("ObjectId"));
  const identityKeys = brandingKeys.filter((k) => !k.endsWith("ObjectId"));
  return (
    <div className="space-y-6">
      <PageHeader title="Branding" description="Product name, colours, company details, social links, default SEO and uploaded brand assets." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity and colours</CardTitle>
            <CardDescription>Used across the marketing site, the app and every email.</CardDescription>
          </CardHeader>
          <CardContent>
            <BrandingForm fields={buildSettingFields(identityKeys, settings)} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand assets</CardTitle>
              <CardDescription>Uploaded as public site assets. Remove to fall back to the built-in files.</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingForm fields={buildSettingFields(assetKeys, settings)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Default SEO</CardTitle>
              <CardDescription>Fallback title and description for pages without their own metadata.</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingForm fields={buildSettingFields(settingKeysWithPrefix("seo"), settings)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
