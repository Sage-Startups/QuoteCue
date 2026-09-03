"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: "left" | "right" | "bottom" }
>(({ className, children, side = "left", ...props }, ref) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-950/50 animate-fade-in" />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 bg-card shadow-elevated outline-none flex flex-col",
        side === "left" && "inset-y-0 left-0 h-full w-[85%] max-w-sm border-r",
        side === "right" && "inset-y-0 right-0 h-full w-[85%] max-w-sm border-l",
        side === "bottom" && "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t",
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

const SheetTitle = SheetPrimitive.Title;
const SheetDescription = SheetPrimitive.Description;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
