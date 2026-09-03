import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSiteSettings } from "@/lib/config/site-settings";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";
import { buildSettingFields, settingKeysWithPrefix } from "../_lib/settings-fields";
import { saveSettingsAction } from "../settings/actions";
import type { AiFeature } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "AI prompts" };

const EDITABLE = (Object.keys(DEFAULT_PROMPTS) as AiFeature[]).filter((f) => f !== "TRANSCRIPTION");

export default async function PromptsPage() {
  await requireSuperAdminForPage("/super-admin/prompts");
  const env = getEnv();
  const [settings, versions] = await Promise.all([getSiteSettings(), prisma.aiPromptVersion.findMany({ orderBy: { version: "desc" }, select: { id: true, feature: true, version: true, isPublished: true, publishedAt: true, createdAt: true, model: true, notes: true } })]);
  const fields = buildSettingFields(settingKeysWithPrefix("ai"), settings, { "ai.textModel": env.OPENAI_TEXT_MODEL, "ai.visionModel": env.OPENAI_VISION_MODEL, "ai.transcribeModel": env.OPENAI_TRANSCRIBE_MODEL });
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI prompts"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>Model configuration and versioned prompts for each AI feature.</span>
            <Badge variant={env.providers.ai === "mock" ? "warning" : "success"}>Provider: {env.providers.ai === "mock" ? "mock (no OPENAI_API_KEY)" : "OpenAI"}</Badge>
          </span>
        }
      />
      {!settings["ai.enabled"] ? <Alert variant="warning">AI features are disabled. Users cannot run analyses or generate wording.</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>AI settings</CardTitle>
          <CardDescription>Model overrides (blank uses the environment default shown as the placeholder) and cost assumptions used for estimated spend.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm fields={fields} action={saveSettingsAction} returnPath="/super-admin/prompts" submitLabel="Save AI settings" columns={2} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {EDITABLE.map((feature) => {
          const def = DEFAULT_PROMPTS[feature];
          const list = versions.filter((v) => v.feature === feature);
          const published = list.find((v) => v.isPublished);
          const label = feature.toLowerCase().replace(/_/g, " ");
          return (
            <Card key={feature}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Link href={`/super-admin/prompts/${feature}`} className="hover:underline">
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </Link>
                  {published ? <Badge variant="success">v{published.version} published</Badge> : <Badge variant="warning">Using built-in default</Badge>}
                </CardTitle>
                <CardDescription>{def.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No versions yet.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {list.slice(0, 5).map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
                        <Link href={`/super-admin/prompts/${feature}?v=${v.id}`} className="min-w-0 truncate hover:underline">
                          Version {v.version}
                          {v.notes ? <span className="text-muted-foreground"> · {v.notes}</span> : null}
                        </Link>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          {formatDateTime(v.createdAt)}
                          {v.isPublished ? <Badge variant="success">Published</Badge> : <Badge variant="muted">Draft</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
