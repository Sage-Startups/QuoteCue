import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSiteSettings } from "@/lib/config/site-settings";

export default async function SuspendedPage() {
  const settings = await getSiteSettings();
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <h1 className="text-2xl font-bold">This workspace is suspended</h1>
      <p className="mt-2 text-muted-foreground">Access to this workspace has been suspended. Please contact support at {settings["branding.supportEmail"]} to resolve this.</p>
      <Button asChild className="mt-6" variant="secondary">
        <Link href="/app/account">Go to your account</Link>
      </Button>
    </div>
  );
}
