import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mock billing portal" };

export default async function MockPortalPage() {
  const ctx = await requireWorkspaceForPage("/app/billing/mock-portal");
  if (!ctx.isAdmin) redirect("/app");
  if (getEnv().isProduction) redirect("/app/billing");
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Alert variant="warning" title="Development mock billing portal">
        With Stripe configured this button opens the Stripe customer portal for payment methods, invoices and cancellation. In mock mode use the Billing page to change plans or cancel.
      </Alert>
      <Button asChild>
        <Link href="/app/billing">Back to billing</Link>
      </Button>
    </div>
  );
}
