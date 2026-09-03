"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const RadioGroup = React.forwardRef<React.ComponentRef<typeof RadioGroupPrimitive.Root>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>>(
  ({ className, ...props }, ref) => <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />,
);
RadioGroup.displayName = "RadioGroup";

const RadioGroupItem = React.forwardRef<React.ComponentRef<typeof RadioGroupPrimitive.Item>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>>(
  ({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square size-5 rounded-full border border-input bg-white text-primary shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="size-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  ),
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
