import * as React from "react";
import { cn } from "@/lib/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border border-input bg-white px-3 py-2 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:outline-destructive md:h-10 md:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
