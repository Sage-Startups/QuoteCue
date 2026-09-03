"use client";

import { Ban, Download, LifeBuoy, RotateCcw, Trash2, TimerOff, Undo2 } from "lucide-react";
import { ConfirmButton } from "@/components/app/confirm-button";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { startSupportSessionAction } from "../../support-actions";
import { suspendWorkspaceAction, restoreWorkspaceAction, grantWorkspaceCreditsAction, startWorkspaceDeletionAction, cancelWorkspaceDeletionAction, deleteWorkspaceNowAction } from "../actions";

export interface WorkspacePanelProps {
  workspace: { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION"; isDemo: boolean };
}

export function WorkspaceQuickActions({ workspace }: WorkspacePanelProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {workspace.status === "SUSPENDED" ? (
        <ConfirmButton action={restoreWorkspaceAction} hidden={{ workspaceId: workspace.id }} variant="default" confirmTitle="Restore this workspace?" confirmDescription="Members will regain access immediately." confirmLabel="Restore">
          <RotateCcw /> Restore
        </ConfirmButton>
      ) : (
        <ConfirmButton action={suspendWorkspaceAction} hidden={{ workspaceId: workspace.id }} variant="destructive" disabled={workspace.isDemo || workspace.status === "PENDING_DELETION"} confirmTitle="Suspend this workspace?" confirmDescription="Members will see a suspended notice and cannot use the workspace until it is restored. The reason is recorded in the audit log." confirmLabel="Suspend" reasonField={{ name: "reason", label: "Reason (required)", required: true }}>
          <Ban /> Suspend
        </ConfirmButton>
      )}
      <Button asChild variant="secondary">
        <a href={`/super-admin/workspaces/${workspace.id}/export`} download>
          <Download /> Export data (JSON)
        </a>
      </Button>
    </div>
  );
}

export function SupportModeForm({ workspace }: WorkspacePanelProps) {
  return (
    <form action={startSupportSessionAction} className="space-y-3">
      <input type="hidden" name="workspaceId" value={workspace.id} />
      <Field label="Reason for access" htmlFor="support-reason" required hint="Recorded in the audit log and visible to the workspace in its activity history. Support mode is read-only and expires after two hours.">
        <Input id="support-reason" name="reason" required minLength={5} maxLength={500} placeholder="e.g. Customer reported PDF layout issue on quote QC-2026-0012" />
      </Field>
      <Button type="submit" variant="secondary">
        <LifeBuoy /> Open in support mode
      </Button>
    </form>
  );
}

function ReasonField({ id }: { id: string }) {
  const error = useFieldError("reason");
  return (
    <Field label="Reason" htmlFor={id} required error={error} hint="Recorded in the audit log.">
      <Textarea id={id} name="reason" rows={2} required minLength={5} maxLength={500} />
    </Field>
  );
}

export function PromotionalCreditsForm({ workspace }: WorkspacePanelProps) {
  const amountError = useFieldError("amount");
  return (
    <ActionForm action={grantWorkspaceCreditsAction} hidden={{ workspaceId: workspace.id }} submitLabel="Grant credits" submitVariant="secondary" resetOnSuccess className="space-y-3">
      <Field label="Credits to add" htmlFor="promo-amount" required error={amountError} hint="Promotional credits never expire and are used after the plan allowance.">
        <Input id="promo-amount" name="amount" type="number" min={1} max={500} step={1} defaultValue={5} required />
      </Field>
      <ReasonField id="promo-reason" />
    </ActionForm>
  );
}

export function DeletionPanel({ workspace }: WorkspacePanelProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {workspace.status === "PENDING_DELETION" ? (
        <ConfirmButton action={cancelWorkspaceDeletionAction} hidden={{ workspaceId: workspace.id }} variant="secondary" confirmTitle="Cancel the pending deletion?" confirmDescription="The workspace returns to active status." confirmLabel="Cancel deletion">
          <Undo2 /> Cancel deletion
        </ConfirmButton>
      ) : (
        <ConfirmButton action={startWorkspaceDeletionAction} hidden={{ workspaceId: workspace.id }} variant="outline" disabled={workspace.isDemo} confirmTitle="Start deletion for this workspace?" confirmDescription="The workspace is marked as pending deletion and members lose access. Data is retained until it is deleted permanently." confirmLabel="Start deletion" typeToConfirm={workspace.slug} reasonField={{ name: "reason", label: "Reason (required)", required: true }}>
          <TimerOff /> Start deletion
        </ConfirmButton>
      )}
      <ConfirmButton action={deleteWorkspaceNowAction} hidden={{ workspaceId: workspace.id }} variant="destructive" disabled={workspace.isDemo} confirmTitle="Delete this workspace permanently?" confirmDescription="All quotes, customers, catalogue items, files and billing records for this workspace are removed. This cannot be undone." confirmLabel="Delete now" typeToConfirm={workspace.slug} reasonField={{ name: "reason", label: "Reason (required)", required: true }} redirectTo="/super-admin/workspaces">
        <Trash2 /> Delete now
      </ConfirmButton>
    </div>
  );
}
