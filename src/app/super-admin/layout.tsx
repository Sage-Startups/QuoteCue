import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireSuperAdminForPage } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { signOutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: { default: "Super admin", template: "%s · Super admin" }, robots: { index: false, follow: false } };

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdminForPage("/super-admin");
  const env = getEnv();
  return (
    <AdminShell user={{ name: session.user.name, email: session.user.email, image: session.user.image }} environment={env.isProduction ? "production" : env.NODE_ENV} signOutAction={signOutAction}>
      {children}
    </AdminShell>
  );
}
