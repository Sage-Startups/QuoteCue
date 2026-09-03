import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { MagicLinkForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in with a link", robots: { index: false } };

export default function MagicLinkPage() {
  return (
    <AuthCard
      title="Sign in with a link"
      description="We will email you a one-time link that signs you in without a password."
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Use a password instead
        </Link>
      }
    >
      <MagicLinkForm />
    </AuthCard>
  );
}
