import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Accessible accordion built on native <details>/<summary>; works without JavaScript. */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn("divide-y rounded-2xl border bg-white shadow-card", className)}>
      {items.map((item, index) => (
        <details key={`${index}-${item.question}`} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-foreground marker:content-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground md:text-base">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
