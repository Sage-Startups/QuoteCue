import { Badge } from "@/components/ui/badge";
import type { SubscriptionStatus, WorkspaceStatus, EmailStatus, JobStatus, WebhookStatus, AiRunStatus, PlatformRole } from "@/generated/prisma/enums";

type Variant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "info" | "accent" | "muted";

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="accent" className={className} title="Demonstration workspace with sample data">
      Demo
    </Badge>
  );
}

const SUBSCRIPTION: Record<SubscriptionStatus, { label: string; variant: Variant }> = {
  TRIALING: { label: "Trial", variant: "info" },
  ACTIVE: { label: "Active", variant: "success" },
  PAST_DUE: { label: "Past due", variant: "warning" },
  CANCELED: { label: "Cancelled", variant: "muted" },
  UNPAID: { label: "Unpaid", variant: "destructive" },
  INCOMPLETE: { label: "Incomplete", variant: "warning" },
  INCOMPLETE_EXPIRED: { label: "Expired", variant: "muted" },
  PAUSED: { label: "Paused", variant: "muted" },
  COMPLIMENTARY: { label: "Complimentary", variant: "accent" },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const s = SUBSCRIPTION[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const WORKSPACE: Record<WorkspaceStatus, { label: string; variant: Variant }> = {
  ACTIVE: { label: "Active", variant: "success" },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
  PENDING_DELETION: { label: "Pending deletion", variant: "warning" },
};

export function WorkspaceStatusBadge({ status }: { status: WorkspaceStatus }) {
  const s = WORKSPACE[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const EMAIL: Record<EmailStatus, Variant> = { QUEUED: "info", SENT: "success", DELIVERED: "success", FAILED: "destructive", PREVIEW: "muted", SKIPPED: "warning" };

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  return <Badge variant={EMAIL[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

const JOB: Record<JobStatus, Variant> = { RUNNING: "info", SUCCEEDED: "success", FAILED: "destructive", SKIPPED: "muted" };

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={JOB[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

const WEBHOOK: Record<WebhookStatus, Variant> = { RECEIVED: "info", PROCESSED: "success", FAILED: "destructive", IGNORED: "muted" };

export function WebhookStatusBadge({ status }: { status: WebhookStatus }) {
  return <Badge variant={WEBHOOK[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

const AI: Record<AiRunStatus, Variant> = { RUNNING: "info", SUCCEEDED: "success", FAILED: "destructive" };

export function AiRunStatusBadge({ status }: { status: AiRunStatus }) {
  return <Badge variant={AI[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

const ROLE: Record<PlatformRole, { label: string; variant: Variant }> = {
  USER: { label: "User", variant: "muted" },
  SUPPORT_ADMIN: { label: "Support admin", variant: "info" },
  SUPER_ADMIN: { label: "Super admin", variant: "accent" },
};

export function PlatformRoleBadge({ role }: { role: PlatformRole }) {
  const r = ROLE[role];
  return <Badge variant={r.variant}>{r.label}</Badge>;
}

export function BoolBadge({ value, yes = "Yes", no = "No" }: { value: boolean; yes?: string; no?: string }) {
  return <Badge variant={value ? "success" : "muted"}>{value ? yes : no}</Badge>;
}
