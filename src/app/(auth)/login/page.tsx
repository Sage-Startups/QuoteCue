import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/misc";
import { getSessionContext } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; verified?: string; error?: string }> }) {
  const params = await searchParams;
  const session = await getSessionContext();
  if (session) redirect(safeRedirectPath(params.next, "/app"));
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your QuoteCue workspace."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      {params.verified === "1" ? <Alert variant="success">Your email is verified. Sign in to continue.</Alert> : null}
      {params.error === "invalid_token" ? <Alert variant="warning">That link is invalid or has expired. Please sign in or request a new link.</Alert> : null}
      <SignInForm next={safeRedirectPath(params.next, "/app")} />
    </AuthCard>
  );
}
