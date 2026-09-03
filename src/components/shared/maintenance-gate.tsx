import Image from "next/image";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getSessionContext } from "@/lib/auth/session";

const ALWAYS_OPEN = ["/login", "/api/", "/super-admin", "/forgot-password", "/reset-password", "/magic-link", "/verify-email"];

/**
 * When maintenance mode is enabled in site settings, non-admin visitors see a
 * maintenance page. Super admins, sign-in routes and API routes stay available.
 */
export async function MaintenanceGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const settings = await getSiteSettings();
  if (!settings["app.maintenanceMode"]) return <>{children}</>;
  if (ALWAYS_OPEN.some((p) => pathname === p || pathname.startsWith(p))) return <>{children}</>;
  const session = await getSessionContext().catch(() => null);
  if (session?.user.platformRole === "SUPER_ADMIN") return <>{children}</>;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Image src="/brand/logo-light.svg" alt={settings["branding.productName"]} width={200} height={50} className="h-10 w-auto" priority />
      <h1 className="mt-6 text-2xl font-bold tracking-tight">We will be back shortly</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{settings["app.maintenanceMessage"]}</p>
      <p className="mt-6 text-xs text-muted-foreground">Need help? {settings["branding.supportEmail"]}</p>
    </main>
  );
}
