import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { enumParam } from "../../_lib/admin";
import { NewVersionButton, PromptTester, PromptVersionForm, VersionActions } from "./panels";
import type { AiFeature } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "AI prompt" };

const EDITABLE = (Object.keys(DEFAULT_PROMPTS) as AiFeature[]).filter((f) => f !== "TRANSCRIPTION");

export default async function PromptFeaturePage({ params, searchParams }: { params: Promise<{ feature: string }>; searchParams: Promise<{ v?: string }> }) {
  const { feature: raw } = await params;
  const query = await searchParams;
  await requireSuperAdminForPage(`/super-admin/prompts/${raw}`);
  const feature = enumParam(raw, EDITABLE);
  if (!feature) notFound();
  const def = DEFAULT_PROMPTS[feature];
  const env = getEnv();
  const versions = await prisma.aiPromptVersion.findMany({ where: { feature }, orderBy: { version: "desc" }, include: { createdBy: { select: { name: true } }, _count: { select: { runs: true } } } });
  const published = versions.find((v) => v.isPublished) ?? null;
  const selected = versions.find((v) => v.id === query.v) ?? versions.find((v) => !v.isPublished) ?? published ?? versions[0] ?? null;
  const summaries = versions.map((v) => ({ id: v.id, version: v.version, isPublished: v.isPublished, model: v.model, notes: v.notes }));
  const label = feature.toLowerCase().replace(/_/g, " ");
  const modelPlaceholder = feature === "IMAGE_ANALYSIS" ? env.OPENAI_VISION_MODEL : env.OPENAI_TEXT_MODEL;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/prompts" className="hover:underline">
            AI prompts
          </Link>
        }
        title={label.charAt(0).toUpperCase() + label.slice(1)}
        description={def.description}
        actions={<NewVersionButton feature={feature} />}
      />
      {!published ? <Alert variant="warning">No version is published. AI runs use the built-in default prompt until one is published.</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>Select a version to view or edit.</CardDescription>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No versions yet. Create one to start editing.</p>
            ) : (
              <ul className="space-y-1">
                {versions.map((v) => (
                  <li key={v.id}>
                    <Link href={`/super-admin/prompts/${feature}?v=${v.id}`} aria-current={selected?.id === v.id ? "page" : undefined} className={cn("block rounded-lg border px-3 py-2 text-sm hover:bg-muted", selected?.id === v.id && "border-primary bg-muted")}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">Version {v.version}</span>
                        {v.isPublished ? <Badge variant="success">Published</Badge> : <Badge variant="muted">Draft</Badge>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(v.createdAt)}
                        {v.createdBy ? ` · ${v.createdBy.name}` : ""} · {v._count.runs} run{v._count.runs === 1 ? "" : "s"}
                      </span>
                      {v.notes ? <span className="block truncate text-xs text-muted-foreground">{v.notes}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="min-w-0 space-y-6">
          {selected ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>Version {selected.version}</CardTitle>
                    <CardDescription>
                      {selected.isPublished ? `Published ${selected.publishedAt ? formatDateTime(selected.publishedAt) : ""}` : "Unpublished draft"} · model {selected.model ?? `default (${modelPlaceholder})`}
                    </CardDescription>
                  </div>
                  <VersionActions version={{ id: selected.id, version: selected.version, isPublished: selected.isPublished, model: selected.model, notes: selected.notes }} publishedVersion={published?.version ?? null} />
                </div>
              </CardHeader>
              <CardContent>
                <PromptVersionForm version={{ id: selected.id, version: selected.version, isPublished: selected.isPublished, model: selected.model, notes: selected.notes, systemPrompt: selected.systemPrompt, userTemplate: selected.userTemplate }} variables={def.variables} modelPlaceholder={modelPlaceholder} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Built-in default</CardTitle>
                <CardDescription>This prompt is used until a version is created and published.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/60 p-3 font-mono text-xs">{def.systemPrompt}</pre>
                <pre className="overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/60 p-3 font-mono text-xs">{def.userTemplate}</pre>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Prompt tester</CardTitle>
              <CardDescription>Runs the selected system prompt against sample input through the {env.providers.ai === "mock" ? "mock" : "OpenAI"} provider. The feature&apos;s structured schema is not enforced; the response is free text.</CardDescription>
            </CardHeader>
            <CardContent>
              <PromptTester feature={feature} versions={summaries} defaultVersionId={selected?.id ?? ""} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
