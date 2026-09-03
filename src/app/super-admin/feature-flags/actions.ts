"use server";

import { z } from "zod";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/config/feature-flags";
import { fail, type ActionResult } from "@/lib/utils/result";
import { adminAction } from "../_lib/admin";
import { applyFeatureFlag } from "../_lib/apply";

const schema = z.object({ key: z.enum(Object.keys(FEATURE_FLAGS) as [FeatureFlagKey, ...FeatureFlagKey[]]), enabled: z.enum(["true", "false"]) });

export async function toggleFeatureFlagAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = schema.safeParse({ key: formData.get("key"), enabled: formData.get("enabled") });
    if (!parsed.success) return fail("Unknown feature flag.");
    return applyFeatureFlag(admin, parsed.data.key, parsed.data.enabled === "true", "flag.update");
  });
}
