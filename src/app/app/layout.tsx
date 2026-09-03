import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getSessionContext, getWorkspaceContext, WORKSPACE_COOKIE } from "@/lib/auth";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { getEnv } from "@/lib/env";
import { signOutAction } from "@/app/(auth)/actions";
import { endSupportSessionAction } from "@/app/super-admin/support-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  if (!session) redirect("/login?next=/app");
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    const cookieStore = await cookies();
    if (cookieStore.get(WORKSPACE_COOKIE)) {
      // Stale workspace cookie: fall through to onboarding check.
    }
    redirect("/onboarding");
  }
  if (ctx.workspace.status === "SUSPENDED" && !ctx.supportSession) redirect("/app/suspended");
  const entitlements = await getWorkspaceEntitlements(ctx.workspace.id);
  const env = getEnv();
  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email, image: session.user.image, isSuperAdmin: session.user.platformRole === "SUPER_ADMIN" }}
      workspace={{ name: ctx.workspace.name, isDemo: ctx.workspace.isDemo }}
      isAdmin={ctx.isAdmin}
      isDev={!env.isProduction && env.providers.email === "preview"}
      supportMode={ctx.supportSession ? { reason: ctx.supportSession.reason, expiresAt: ctx.supportSession.expiresAt.toISOString() } : null}
      usage={{ planName: entitlements.planName, used: entitlements.usedThisPeriod, allowance: entitlements.allowancePerPeriod, credits: entitlements.creditBalance, isTrial: entitlements.isTrial }}
      signOutAction={signOutAction}
      endSupportAction={ctx.supportSession ? endSupportSessionAction : undefined}
    >
      {children}
    </AppShell>
  );
}
