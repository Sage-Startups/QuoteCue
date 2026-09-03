import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Verify your email"
      description="We sent a verification link to your inbox. Click it to activate your account, then sign in."
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {params.error ? <Alert variant="warning">That verification link is invalid or has expired. Request a new one below.</Alert> : null}
      <ResendVerificationForm defaultEmail={params.email} />
    </AuthCard>
  );
}
