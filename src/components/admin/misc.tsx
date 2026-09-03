import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** Pretty-printed JSON in a scrollable block (server-safe). */
export function JsonBlock({ value, className, maxHeight = "16rem" }: { value: unknown; className?: string; maxHeight?: string }) {
  if (value === undefined || value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre className={cn("overflow-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground", className)} style={{ maxHeight }}>
      {text}
    </pre>
  );
}

export function CsvExportLink({ href, label = "Export CSV" }: { href: string; label?: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={href} download>
        <Download /> {label}
      </a>
    </Button>
  );
}

/** Two-column definition list used on detail pages. */
export function DescriptionList({ items, className }: { items: Array<{ label: React.ReactNode; value: React.ReactNode }>; className?: string }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]", className)}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words font-medium">{item.value ?? "—"}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** Sandboxed HTML preview; scripts and same-origin access are blocked. */
export function HtmlPreview({ html, title, className }: { html: string; title: string; className?: string }) {
  return <iframe title={title} srcDoc={html} sandbox="" className={cn("h-[28rem] w-full rounded-xl border bg-white", className)} />;
}

export function InlineLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-medium underline-offset-2 hover:underline", className)}>
      {children}
    </Link>
  );
}

export function SectionTitle({ children, description }: { children: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  actor?: { name: string | null; email: string | null } | null;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  previousValue: unknown;
  newValue: unknown;
  createdAt: Date;
}

/** Compact audit-history list used on detail pages. */
export function AuditEntryList({ entries, currentTargetId, formatDateTime }: { entries: AuditEntry[]; currentTargetId?: string; formatDateTime: (d: Date) => string }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <ul className="divide-y">
      {entries.map((a) => (
        <li key={a.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold">{a.action}</span>
              <span className="text-sm text-muted-foreground">
                by {a.actor?.name ?? a.actorEmail ?? "system"}
                {a.targetId && a.targetId !== currentTargetId ? ` · target ${a.targetType} ${a.targetId.slice(0, 8)}…` : ""}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
          </div>
          {a.reason ? <p className="mt-1 text-sm">Reason: {a.reason}</p> : null}
          {a.previousValue !== null || a.newValue !== null ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Details</summary>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Previous</p>
                  <JsonBlock value={a.previousValue} maxHeight="10rem" />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">New</p>
                  <JsonBlock value={a.newValue} maxHeight="10rem" />
                </div>
              </div>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Small key/value stat row used inside cards. */
export function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
