"use server";

import { revalidatePath } from "next/cache";
import { decisionSchema, recordCustomerDecision } from "@/lib/services/public-quote";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/utils/request";
import { hashIp } from "@/lib/utils/tokens";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";

export async function customerDecisionAction(_prev: ActionResult<{ decision: "ACCEPTED" | "DECLINED" }> | null, formData: FormData): Promise<ActionResult<{ decision: "ACCEPTED" | "DECLINED" }>> {
  const token = String(formData.get("token") ?? "");
  const ip = await getClientIp();
  const limit = await checkRateLimit("publicQuoteDecision", ip ?? "unknown");
  if (!limit.allowed) return fail("Too many attempts. Please wait a few minutes and try again.");
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.termsAccepted = formData.get("termsAccepted") === "on";
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  try {
    const result = await recordCustomerDecision(token, parsed.data, { ipHash: hashIp(ip), userAgent: await getUserAgent() });
    revalidatePath(`/q/${token}`);
    return ok({ decision: result.decision }, result.decision === "ACCEPTED" ? "Thank you, the quote has been accepted." : "The quote has been declined.");
  } catch (error) {
    return fail(toUserMessage(error, "We could not record your decision. Please try again or contact the business."));
  }
}
