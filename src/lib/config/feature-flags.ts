import { prisma } from "@/lib/db";

export const FEATURE_FLAGS = {
  voice_recording: { name: "Voice recording", description: "Allow recording and uploading voice notes in the quote wizard.", default: true },
  photo_analysis: { name: "Photograph analysis", description: "Allow AI analysis of uploaded job photographs.", default: true },
  email_sending: { name: "Email sending", description: "Allow quotes and notifications to be emailed.", default: true },
  customer_acceptance: { name: "Customer acceptance", description: "Allow customers to accept or decline quotes online.", default: true },
  team_accounts: { name: "Team accounts", description: "Allow workspace admins to invite team members.", default: true },
  advanced_analytics: { name: "Advanced analytics", description: "Enable advanced analytics views for Pro workspaces.", default: true },
  magic_link_login: { name: "Magic-link login", description: "Allow passwordless sign-in links.", default: true },
  experimental: { name: "Experimental features", description: "Enable experimental features for testing.", default: false },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

let cache: { value: Record<FeatureFlagKey, boolean>; expiresAt: number } | null = null;

export function invalidateFeatureFlagCache(): void {
  cache = null;
}

export async function getFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const rows = await prisma.featureFlag.findMany();
  const flags = Object.fromEntries(
    (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((k) => [k, FEATURE_FLAGS[k].default]),
  ) as Record<FeatureFlagKey, boolean>;
  for (const row of rows) {
    if (row.key in FEATURE_FLAGS) flags[row.key as FeatureFlagKey] = row.enabled;
  }
  cache = { value: flags, expiresAt: Date.now() + 15_000 };
  return flags;
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[key];
}
