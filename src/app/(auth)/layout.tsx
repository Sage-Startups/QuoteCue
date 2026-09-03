import Link from "next/link";
import Image from "next/image";
import { getSiteSettings } from "@/lib/config/site-settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="inline-flex items-center gap-2" aria-label={`${settings["branding.productName"]} home`}>
          <Image src="/brand/logo-light.svg" alt={settings["branding.productName"]} width={170} height={42} priority className="h-9 w-auto" />
        </Link>
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Back to site
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 md:items-center md:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-5 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings["branding.companyName"]} ·{" "}
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </footer>
    </div>
  );
}
