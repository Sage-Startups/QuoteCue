import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Pagination({ page, pages, total, basePath, params }: { page: number; pages: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  if (pages <= 1) return <p className="text-xs text-muted-foreground">{total} result{total === 1 ? "" : "s"}</p>;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {pages} · {total} results
      </p>
      <div className="flex gap-1">
        <Link href={build(Math.max(1, page - 1))} aria-disabled={page <= 1} className={cn("inline-flex h-9 items-center gap-1 rounded-lg border bg-white px-3 text-sm font-medium hover:bg-muted", page <= 1 && "pointer-events-none opacity-50")}>
          <ChevronLeft className="size-4" /> Previous
        </Link>
        <Link href={build(Math.min(pages, page + 1))} aria-disabled={page >= pages} className={cn("inline-flex h-9 items-center gap-1 rounded-lg border bg-white px-3 text-sm font-medium hover:bg-muted", page >= pages && "pointer-events-none opacity-50")}>
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
