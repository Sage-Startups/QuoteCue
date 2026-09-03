import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-muted text-foreground",
      outline: "border-border text-foreground bg-white",
      success: "border-transparent bg-green-100 text-green-800",
      warning: "border-transparent bg-amber-100 text-amber-800",
      destructive: "border-transparent bg-red-100 text-red-800",
      info: "border-transparent bg-blue-100 text-blue-800",
      accent: "border-transparent bg-amber-500 text-navy-900",
      muted: "border-transparent bg-slate-100 text-slate-700",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
