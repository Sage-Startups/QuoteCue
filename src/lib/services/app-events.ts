import { prisma } from "@/lib/db";

export type AppEventName =
  | "registration_started"
  | "registration_completed"
  | "email_verified"
  | "onboarding_completed"
  | "quote_started"
  | "ai_analysis_completed"
  | "quote_generated"
  | "quote_sent"
  | "quote_viewed"
  | "quote_accepted"
  | "quote_declined"
  | "trial_limit_reached"
  | "checkout_started"
  | "subscription_activated"
  | "subscription_cancelled"
  | "credit_pack_purchased"
  | "account_deleted"
  | "login";

/**
 * First-party analytics events. Properties must never contain enquiry text,
 * quote wording or other sensitive content: only identifiers and numbers.
 */
export async function trackEvent(input: {
  name: AppEventName;
  userId?: string | null;
  workspaceId?: string | null;
  properties?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    await prisma.applicationEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        workspaceId: input.workspaceId ?? null,
        properties: input.properties ?? undefined,
      },
    });
  } catch (error) {
    console.error("[analytics] failed to record event", input.name, error);
  }
}

export async function recordApplicationError(scope: string, error: unknown, metadata?: Record<string, unknown>): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    await prisma.applicationError.create({
      data: {
        scope,
        message: err.message.slice(0, 2000),
        stack: err.stack?.slice(0, 8000),
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });
  } catch (loggingError) {
    console.error("[errors] failed to record application error", loggingError);
  }
}
