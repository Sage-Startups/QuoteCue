import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export interface BrandLogoProps {
  productName: string;
  logoObjectId: string | null;
  /** "light" = for light backgrounds, "dark" = for dark backgrounds. */
  surface?: "light" | "dark";
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ productName, logoObjectId, surface = "light", className, priority }: BrandLogoProps) {
  const src = logoObjectId ? `/api/files/${logoObjectId}` : surface === "dark" ? "/brand/logo-dark.svg" : "/brand/logo-light.svg";
  return <Image src={src} alt={productName} width={170} height={42} priority={priority} unoptimized={Boolean(logoObjectId)} className={cn("h-9 w-auto", className)} />;
}
