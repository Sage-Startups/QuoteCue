import { Badge } from "@/components/ui/badge";
import type { QuoteStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS } from "@/lib/quotes/status";

const VARIANTS: Record<QuoteStatus, "muted" | "info" | "warning" | "success" | "destructive" | "secondary" | "outline"> = {
  DRAFT: "muted",
  READY: "secondary",
  SENT: "info",
  VIEWED: "warning",
  ACCEPTED: "success",
  DECLINED: "destructive",
  EXPIRED: "outline",
  ARCHIVED: "muted",
};

export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <Badge variant={VARIANTS[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
