import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function Separator({ className, orientation = "horizontal", ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return <div role="separator" aria-orientation={orientation} className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch", className)} {...props} />;
}

const alertStyles = {
  info: { icon: Info, className: "border-blue-200 bg-blue-50 text-blue-900" },
  success: { icon: CheckCircle2, className: "border-green-200 bg-green-50 text-green-900" },
  warning: { icon: TriangleAlert, className: "border-amber-200 bg-amber-50 text-amber-900" },
  destructive: { icon: AlertCircle, className: "border-red-200 bg-red-50 text-red-900" },
} as const;

export function Alert({
  variant = "info",
  title,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof alertStyles; title?: React.ReactNode }) {
  const { icon: Icon, className: variantClass } = alertStyles[variant];
  return (
    <div role={variant === "destructive" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-4 text-sm", variantClass, className)} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Avatar({ name, src, className, size = "md" }: { name: string; src?: string | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const sizeClass = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-100 font-semibold text-navy-800", sizeClass, className)} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

export function Progress({ value, max = 100, className, label }: { value: number; max?: number; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center", className)}>
      {Icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <div className="mt-5">
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: { value: number; label?: string } | null;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-card md:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 text-2xl font-bold tabular tracking-tight md:text-3xl">{value}</p>
      {delta ? (
        <p className={cn("mt-1 text-xs font-medium", delta.value > 0 ? "text-success" : delta.value < 0 ? "text-destructive" : "text-muted-foreground")}>
          {delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "•"} {Math.abs(delta.value).toFixed(0)}% {delta.label ?? "vs previous period"}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string | string[] | null }) {
  if (!message || (Array.isArray(message) && message.length === 0)) return null;
  const text = Array.isArray(message) ? message[0] : message;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-destructive">
      {text}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor: string;
  required?: boolean;
  error?: string | string[] | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? <FieldError id={`${htmlFor}-error`} message={error} /> : hint ? <FieldHint id={`${htmlFor}-hint`}>{hint}</FieldHint> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent", className)} role="status" aria-label="Loading" />
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}
