"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";
import { adminAction, adminAudit } from "../_lib/admin";
import { SUPPORT_VIEW_WINDOW_MS } from "./query";

const schema = z.object({ quoteId: z.string().uuid("Invalid id"), reason: z.string().trim().min(5, "Please give a reason (at least 5 characters)").max(500) });

/** Grants the admin a 30-minute window to view the private content of one quote. Audited and visible in the quote's own activity. */
export async function viewPrivateQuoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return adminAction(async (admin) => {
    const parsed = schema.safeParse({ quoteId: formData.get("quoteId"), reason: formData.get("reason") });
    if (!parsed.success) return fail("Please provide a reason.", zodFieldErrors(parsed.error));
    const quote = await prisma.quote.findFirst({ where: { id: parsed.data.quoteId, deletedAt: null }, select: { id: true, workspaceId: true, number: true } });
    if (!quote) return fail("Quote not found.");
    await adminAudit(admin, { action: "quote.support_view", targetType: "quote", targetId: quote.id, reason: parsed.data.reason, newValue: { workspaceId: quote.workspaceId, number: quote.number, windowMinutes: SUPPORT_VIEW_WINDOW_MS / 60_000 } });
    await prisma.quoteEvent.create({ data: { workspaceId: quote.workspaceId, quoteId: quote.id, type: "SUPPORT_ACCESS", actorType: "ADMIN", actorUserId: admin.user.id, message: parsed.data.reason } });
    revalidatePath(`/super-admin/quotes/${quote.id}`);
    return ok(undefined, "Private content unlocked for 30 minutes.");
  });
}
