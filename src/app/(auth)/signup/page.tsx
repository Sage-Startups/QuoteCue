import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/misc";
import { getSessionContext } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/config/site-settings";

export const metadata: Metadata = { title: "Create your account", description: "Start your free QuoteCue AI trial: three AI quote generations, no card required." };

export default async function SignupPage() {
  const session = await getSessionContext();
  if (session) redirect("/app");
  const settings = await getSiteSettings();
  return (
    <AuthCard
      title="Create your account"
      description={`Free trial with ${settings["app.trialCredits"]} AI quote generations. No card required.`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      {!settings["app.registrationEnabled"] ? <Alert variant="warning">Registration is currently closed.</Alert> : <SignUpForm />}
    </AuthCard>
  );
}
