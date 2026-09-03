import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = await searchParams;
  const invalid = !params.token || params.error === "INVALID_TOKEN";
  return (
    <AuthCard
      title="Choose a new password"
      description="Your other sessions will be signed out once the password is changed."
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {invalid ? (
        <div className="space-y-4">
          <Alert variant="warning">This reset link is invalid or has expired.</Alert>
          <Link href="/forgot-password" className="text-sm font-medium text-primary underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      ) : (
        <ResetPasswordForm token={params.token!} />
      )}
    </AuthCard>
  );
}
