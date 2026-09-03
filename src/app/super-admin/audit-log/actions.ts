"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, type ActionResult } from "@/lib/utils/result";
import { adminAction } from "../_lib/admin";
import { applyFeatureFlag, applyMarketingValue, applySettingValues, isFlagKey, isMarketingKey, isSettingKey } from "../_lib/apply";

/** Re-applies the previous value recorded on a setting, marketing or feature-flag audit entry. */
export async function rollbackAuditEntryAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const id = z.string().uuid().safeParse(formData.get("entryId"));
    if (!id.success) return fail("Invalid audit entry.");
    const entry = await prisma.adminAuditLog.findUnique({ where: { id: id.data } });
    if (!entry) return fail("Audit entry not found.");
    const reason = `Rollback of audit entry ${entry.id} (${entry.action} at ${entry.createdAt.toISOString()})`;
    switch (entry.action) {
      case "setting.update": {
        if (!entry.targetId || !isSettingKey(entry.targetId)) return fail("This entry does not reference a known setting.");
        const result = await applySettingValues(admin, [{ key: entry.targetId, value: entry.previousValue }], "setting.update.rollback", reason);
        return result.ok ? { ok: true, data: undefined, message: result.data.changed.length === 0 ? "The setting already has its previous value." : `Rolled back ${entry.targetId}.` } : result;
      }
      case "marketing.update": {
        if (!entry.targetId || !isMarketingKey(entry.targetId)) return fail("This entry does not reference a known marketing section.");
        const result = await applyMarketingValue(admin, entry.targetId, entry.previousValue, "marketing.update.rollback", reason);
        return result.ok ? { ok: true, data: undefined, message: `Rolled back ${entry.targetId}.` } : result;
      }
      case "flag.update": {
        if (!entry.targetId || !isFlagKey(entry.targetId)) return fail("This entry does not reference a known feature flag.");
        const previous = entry.previousValue as { enabled?: unknown } | null;
        if (!previous || typeof previous.enabled !== "boolean") return fail("The entry has no previous value to restore.");
        return applyFeatureFlag(admin, entry.targetId, previous.enabled, "flag.update.rollback", reason);
      }
      default:
        return fail("Only setting, marketing and feature-flag changes can be rolled back.");
    }
  });
}
