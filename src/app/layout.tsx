import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getEnv } from "@/lib/env";
import { MaintenanceGate } from "@/components/shared/maintenance-gate";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const env = getEnv();
  return {
    metadataBase: new URL(env.APP_URL),
    title: { default: settings["seo.defaultTitle"], template: `%s · ${settings["branding.productName"]}` },
    description: settings["seo.defaultDescription"],
    applicationName: settings["branding.productName"],
    openGraph: { type: "website", siteName: settings["branding.productName"], images: ["/og-image.png"] },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f1f3d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased" data-nonce={nonce}>
        <TooltipProvider delayDuration={200}>
          <MaintenanceGate pathname={pathname}>{children}</MaintenanceGate>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
