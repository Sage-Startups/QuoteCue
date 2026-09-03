import { prisma } from "@/lib/db";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_KINDS } from "@/lib/email/templates";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";
import { PLAN_SEEDS } from "@/lib/billing/plans";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/config/feature-flags";
import { TRADE_TEMPLATES } from "@/lib/data/trade-templates";
import type { AiFeature } from "@/generated/prisma/enums";

/**
 * Seeds platform-level configuration: plans, trade templates, prompt
 * versions, email templates and feature flags. Idempotent: existing rows are
 * updated only where an admin has not customised them (templates and prompts
 * are only created if missing).
 */
export async function seedPlatform(options: { log?: (message: string) => void } = {}): Promise<void> {
  const log = options.log ?? (() => undefined);

  for (const plan of PLAN_SEEDS) {
    const row = await prisma.plan.upsert({
      where: { key: plan.key },
      create: {
        key: plan.key,
        kind: plan.kind,
        name: plan.name,
        description: plan.description,
        monthlyPriceMinor: plan.monthlyPriceMinor,
        annualPriceMinor: plan.annualPriceMinor,
        oneTimePriceMinor: plan.oneTimePriceMinor,
        aiGenerationsPerPeriod: plan.aiGenerationsPerPeriod,
        creditsGranted: plan.creditsGranted,
        maxMembers: plan.maxMembers,
        storageAllowanceMb: plan.storageAllowanceMb,
        highlight: plan.highlight,
        sortOrder: plan.sortOrder,
        featureBullets: plan.featureBullets,
        currency: "USD",
      },
      update: {},
    });
    for (const key of plan.entitlements) {
      await prisma.planEntitlement.upsert({ where: { planId_key: { planId: row.id, key } }, create: { planId: row.id, key, enabled: true }, update: {} });
    }
  }
  log(`Plans: ${PLAN_SEEDS.length}`);

  for (const t of TRADE_TEMPLATES) {
    await prisma.tradeTemplate.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        icon: t.icon,
        suggestedServices: JSON.parse(JSON.stringify(t.suggestedServices)),
        defaultScope: t.defaultScope,
        commonExclusions: t.commonExclusions,
        commonQuestions: t.commonQuestions,
        defaultAssumptions: t.defaultAssumptions,
        defaultTerms: t.defaultTerms,
        sortOrder: t.sortOrder,
      },
      update: {},
    });
  }
  log(`Trade templates: ${TRADE_TEMPLATES.length}`);

  for (const feature of Object.keys(DEFAULT_PROMPTS) as AiFeature[]) {
    const def = DEFAULT_PROMPTS[feature];
    if (!def.systemPrompt && !def.userTemplate) continue;
    const existing = await prisma.aiPromptVersion.findFirst({ where: { feature } });
    if (!existing) {
      await prisma.aiPromptVersion.create({
        data: { feature, version: 1, systemPrompt: def.systemPrompt, userTemplate: def.userTemplate, notes: "Initial version (seeded)", isPublished: true, publishedAt: new Date() },
      });
    }
  }
  log("AI prompts seeded");

  for (const kind of EMAIL_KINDS) {
    const def = DEFAULT_EMAIL_TEMPLATES[kind];
    await prisma.emailTemplate.upsert({
      where: { kind },
      create: { kind, name: def.name, subject: def.subject, previewText: def.previewText, bodyMarkdown: def.bodyMarkdown, variables: def.variables, enabled: true },
      update: { variables: def.variables },
    });
  }
  log(`Email templates: ${EMAIL_KINDS.length}`);

  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    const def = FEATURE_FLAGS[key];
    await prisma.featureFlag.upsert({ where: { key }, create: { key, name: def.name, description: def.description, enabled: def.default }, update: { name: def.name, description: def.description } });
  }
  log("Feature flags seeded");
}
