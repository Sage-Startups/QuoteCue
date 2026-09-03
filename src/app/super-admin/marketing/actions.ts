"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getMarketingContent, invalidateMarketingCache, marketingDefault, marketingSchemas, type MarketingKey } from "@/lib/config/marketing-content";
import { applyMarketingValue } from "../_lib/apply";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { adminAction, adminAudit } from "../_lib/admin";

const keySchema = z.enum(Object.keys(marketingSchemas) as [MarketingKey, ...MarketingKey[]]);

export async function saveMarketingContentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const key = keySchema.safeParse(formData.get("key"));
    if (!key.success) return fail("Unknown content section.");
    let value: unknown;
    try {
      value = JSON.parse(String(formData.get("value") ?? ""));
    } catch {
      return fail("The submitted content was not valid JSON.");
    }
    return applyMarketingValue(admin, key.data, value, "marketing.update");
  });
}

export async function resetMarketingContentAction(formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const key = keySchema.safeParse(formData.get("key"));
    if (!key.success) return fail("Unknown content section.");
    const current = (await getMarketingContent())[key.data];
    const existing = await prisma.marketingContent.findUnique({ where: { key: key.data } });
    if (!existing) return fail("This section already uses the default content.");
    await prisma.marketingContent.delete({ where: { key: key.data } });
    await adminAudit(admin, { action: "marketing.reset", targetType: "marketing_content", targetId: key.data, previousValue: current, newValue: marketingDefault(key.data) });
    invalidateMarketingCache();
    revalidatePath("/", "layout");
    revalidatePath("/super-admin/marketing");
    revalidatePath(`/super-admin/marketing/${key.data}`);
    return ok(undefined, "Section reset to the default content.");
  });
}
