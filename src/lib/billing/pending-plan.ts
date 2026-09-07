/**
 * Plan chosen at sign-up, held until onboarding creates the workspace a
 * subscription can belong to. Kept out of the server-action modules because
 * a "use server" file may only export async functions.
 */
export const PENDING_PLAN_COOKIE = "quotecue.plan";
