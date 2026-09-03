import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "dark";
  "aria-labelledby"?: string;
}

export function Section({ id, children, className, tone = "default", ...rest }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={rest["aria-labelledby"]}
      className={cn(
        "py-14 md:py-20",
        tone === "muted" && "bg-white",
        tone === "dark" && "bg-navy-900 text-white",
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "center",
  as: Tag = "h2",
  tone = "default",
  className,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  tone?: "default" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("mb-10 max-w-2xl md:mb-12", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className={cn("mb-3 text-xs font-semibold uppercase tracking-[0.14em]", tone === "dark" ? "text-amber-300" : "text-accent")}>{eyebrow}</p>
      ) : null}
      <Tag id={id} className={cn("text-balance font-bold tracking-tight", Tag === "h1" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl", tone === "dark" ? "text-white" : "text-foreground")}>
        {title}
      </Tag>
      {description ? <p className={cn("mt-4 text-base md:text-lg", tone === "dark" ? "text-navy-100" : "text-muted-foreground")}>{description}</p> : null}
    </div>
  );
}

export function IconTile({ children, className, tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "accent" | "dark" }) {
  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-lg",
        tone === "default" && "bg-navy-50 text-navy-700",
        tone === "accent" && "bg-amber-100 text-amber-800",
        tone === "dark" && "bg-white/10 text-amber-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, children }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b bg-white">
      <Container className="py-14 md:py-20">
        <div className="max-w-3xl">
          {eyebrow ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p> : null}
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">{title}</h1>
          {description ? <p className="mt-4 text-lg text-muted-foreground md:text-xl">{description}</p> : null}
          {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
        </div>
      </Container>
    </div>
  );
}
