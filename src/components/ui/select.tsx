import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Native select styled to match inputs: keyboard and mobile friendly. */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full appearance-none rounded-lg border border-input bg-white px-3 py-2 pr-9 text-base text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive md:h-10 md:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
  </div>
));
Select.displayName = "Select";

export { Select };
