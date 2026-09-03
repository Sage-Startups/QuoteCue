import type { Metadata } from "next";
import { requireSuperAdminForPage } from "@/lib/auth";
import { getSiteSettings } from "@/lib/config/site-settings";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";
import { buildSettingFields, settingKeysWithPrefix } from "../_lib/settings-fields";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Site settings" };

const GROUPS: Array<{ prefix: string; title: string; description: string; columns?: 1 | 2 }> = [
  { prefix: "app", title: "Application", description: "Registration, maintenance mode, trial credits, quote defaults, upload limits, currencies, tax labels and retention.", columns: 2 },
  { prefix: "email", title: "Email defaults", description: "Sender name, reply-to address, footer text and reminder timing." },
  { prefix: "announcement", title: "Announcement banner", description: "Optional banner shown on the marketing site." },
  { prefix: "analytics", title: "Analytics", description: "Optional external analytics identifier." },
];

export default async function SiteSettingsPage() {
  await requireSuperAdminForPage("/super-admin/settings");
  const settings = await getSiteSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Site settings" description="Platform-wide configuration. Every change is validated and recorded in the audit log with its previous value." />
      {settings["app.maintenanceMode"] ? <Alert variant="warning" title="Maintenance mode is on">Non-admin visitors currently see the maintenance page.</Alert> : null}
      {!settings["app.registrationEnabled"] ? <Alert variant="info">New registrations are currently disabled.</Alert> : null}
      {GROUPS.map((g) => (
        <Card key={g.prefix}>
          <CardHeader>
            <CardTitle>{g.title}</CardTitle>
            <CardDescription>{g.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm fields={buildSettingFields(settingKeysWithPrefix(g.prefix), settings)} action={saveSettingsAction} returnPath="/super-admin/settings" columns={g.columns ?? 1} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
