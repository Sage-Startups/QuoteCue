import * as React from "react";
import { cn } from "@/lib/utils/cn";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label"> & { required?: boolean }>(
  ({ className, required, children, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  ),
);
Label.displayName = "Label";

export { Label };
