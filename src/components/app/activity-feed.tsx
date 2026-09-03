import Link from "next/link";
import { CheckCircle2, Eye, FileText, Mail, PlusCircle, Sparkles, XCircle, Clock, Archive, RotateCcw, Copy, FileDown, Link2, Bell, ShieldCheck, Pencil, type LucideIcon } from "lucide-react";
import { formatRelative } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  CREATED: { icon: PlusCircle, className: "bg-slate-100 text-slate-700" },
  UPDATED: { icon: Pencil, className: "bg-slate-100 text-slate-700" },
  AI_ANALYSIS: { icon: Sparkles, className: "bg-amber-100 text-amber-800" },
  AI_GENERATION: { icon: Sparkles, className: "bg-amber-100 text-amber-800" },
  READY: { icon: FileText, className: "bg-slate-100 text-slate-700" },
  SENT: { icon: Mail, className: "bg-blue-100 text-blue-800" },
  EMAIL_DELIVERED: { icon: Mail, className: "bg-blue-100 text-blue-800" },
  EMAIL_FAILED: { icon: XCircle, className: "bg-red-100 text-red-800" },
  VIEWED: { icon: Eye, className: "bg-amber-100 text-amber-800" },
  VIEW_REPEAT: { icon: Eye, className: "bg-slate-100 text-slate-700" },
  ACCEPTED: { icon: CheckCircle2, className: "bg-green-100 text-green-800" },
  DECLINED: { icon: XCircle, className: "bg-red-100 text-red-800" },
  EXPIRED: { icon: Clock, className: "bg-slate-100 text-slate-700" },
  REACTIVATED: { icon: RotateCcw, className: "bg-blue-100 text-blue-800" },
  REVISION_CREATED: { icon: Copy, className: "bg-slate-100 text-slate-700" },
  DUPLICATED: { icon: Copy, className: "bg-slate-100 text-slate-700" },
  ARCHIVED: { icon: Archive, className: "bg-slate-100 text-slate-700" },
  RESTORED: { icon: RotateCcw, className: "bg-slate-100 text-slate-700" },
  PDF_GENERATED: { icon: FileDown, className: "bg-slate-100 text-slate-700" },
  LINK_COPIED: { icon: Link2, className: "bg-slate-100 text-slate-700" },
  REMINDER_SENT: { icon: Bell, className: "bg-blue-100 text-blue-800" },
  SUPPORT_ACCESS: { icon: ShieldCheck, className: "bg-amber-100 text-amber-800" },
  NOTE: { icon: Pencil, className: "bg-slate-100 text-slate-700" },
};

export interface ActivityItem {
  id: string;
  type: string;
  message: string | null;
  createdAt: Date;
  actorName?: string | null;
  quoteId?: string;
  quoteNumber?: string;
}

export function ActivityFeed({ items, showQuote = true, emptyMessage = "No activity yet." }: { items: ActivityItem[]; showQuote?: boolean; emptyMessage?: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const meta = ICONS[item.type] ?? ICONS.NOTE!;
        const Icon = meta.icon;
        return (
          <li key={item.id} className="flex gap-3">
            <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", meta.className)} aria-hidden="true">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                {showQuote && item.quoteId ? (
                  <Link href={`/app/quotes/${item.quoteId}`} className="font-semibold hover:underline">
                    {item.quoteNumber}
                  </Link>
                ) : null}
                {showQuote && item.quoteId ? " · " : ""}
                {item.message ?? item.type.toLowerCase().replace(/_/g, " ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatRelative(item.createdAt)}
                {item.actorName ? ` · ${item.actorName}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
