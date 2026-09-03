import type { Metadata } from "next";
import { requireSuperAdminForPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEATURE_FLAGS, getFeatureFlags, type FeatureFlagKey } from "@/lib/config/feature-flags";
import { formatDateTime } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { SwitchAction } from "@/components/admin/switch-action";
import { toggleFeatureFlagAction } from "./actions";

export const metadata: Metadata = { title: "Feature flags" };

export default async function FeatureFlagsPage() {
  await requireSuperAdminForPage("/super-admin/feature-flags");
  const [flags, rows] = await Promise.all([getFeatureFlags(), prisma.featureFlag.findMany()]);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return (
    <div className="space-y-6">
      <PageHeader title="Feature flags" description="Platform-wide switches. Changes take effect within a few seconds and are recorded in the audit log." />
      <ul className="divide-y rounded-xl border bg-card shadow-card">
        {(Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => {
          const def = FEATURE_FLAGS[key];
          const row = byKey.get(key);
          const enabled = flags[key];
          return (
            <li key={key} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{def.name}</p>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</code>
                  {enabled !== def.default ? <Badge variant="warning">Overrides default ({def.default ? "on" : "off"})</Badge> : <Badge variant="muted">Default</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{def.description}</p>
                {row ? <p className="mt-1 text-xs text-muted-foreground">Last changed {formatDateTime(row.updatedAt)}</p> : null}
              </div>
              <SwitchAction action={toggleFeatureFlagAction} hidden={{ key }} checked={enabled} label={`${def.name}: ${enabled ? "enabled" : "disabled"}`} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
