"use client";
import { timeAgo } from "@/components/admin/format";

import { Ban, KeyRound, LogOut, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/app/confirm-button";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { Field } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { suspendUserAction, restoreUserAction, revokeSessionsAction, sendPasswordResetAction, changeRoleAction, grantUserCreditsAction, applyComplimentaryPlanAction, deleteUserAction } from "../actions";

export interface UserPanelProps {
  user: { id: string; email: string; platformRole: "USER" | "SUPPORT_ADMIN" | "SUPER_ADMIN"; suspended: boolean; isSelf: boolean };
  workspaces: Array<{ id: string; name: string; isDemo: boolean }>;
  plans: Array<{ id: string; name: string }>;
}

export function UserQuickActions({ user }: { user: UserPanelProps["user"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {user.suspended ? (
        <ConfirmButton action={restoreUserAction} hidden={{ userId: user.id }} variant="default" confirmTitle="Restore this user?" confirmDescription="The user will be able to sign in again." confirmLabel="Restore">
          <RotateCcw /> Restore
        </ConfirmButton>
      ) : (
        <ConfirmButton action={suspendUserAction} hidden={{ userId: user.id }} variant="destructive" disabled={user.isSelf} confirmTitle="Suspend this user?" confirmDescription="The user is signed out everywhere and cannot sign in until restored. The reason is recorded in the audit log." confirmLabel="Suspend" reasonField={{ name: "reason", label: "Reason (required)", required: true }}>
          <Ban /> Suspend
        </ConfirmButton>
      )}
      <ConfirmButton action={revokeSessionsAction} hidden={{ userId: user.id }} variant="secondary" confirmTitle="Revoke all sessions?" confirmDescription="The user is signed out on every device." confirmLabel="Revoke sessions">
        <LogOut /> Revoke sessions
      </ConfirmButton>
      <ConfirmButton action={sendPasswordResetAction} hidden={{ userId: user.id }} variant="secondary" confirmTitle="Send a password reset email?" confirmDescription={`A reset link will be emailed to ${user.email}.`} confirmLabel="Send email">
        <KeyRound /> Send password reset
      </ConfirmButton>
    </div>
  );
}

function ReasonField({ id = "reason" }: { id?: string }) {
  const error = useFieldError("reason");
  return (
    <Field label="Reason" htmlFor={id} required error={error} hint="Recorded in the audit log.">
      <Textarea id={id} name="reason" rows={2} required minLength={5} maxLength={500} />
    </Field>
  );
}

export function RoleForm({ user }: { user: UserPanelProps["user"] }) {
  const error = useFieldError("role");
  return (
    <ActionForm action={changeRoleAction} hidden={{ userId: user.id }} submitLabel="Change role" submitVariant="secondary" className="space-y-3">
      <Field label="Platform role" htmlFor="role" error={error} hint={user.isSelf ? "You cannot change your own role." : "Promotions and demotions are audited. The last super admin cannot be demoted."}>
        <Select id="role" name="role" defaultValue={user.platformRole} disabled={user.isSelf}>
          <option value="USER">User</option>
          <option value="SUPPORT_ADMIN">Support admin</option>
          <option value="SUPER_ADMIN">Super admin</option>
        </Select>
      </Field>
      <ReasonField id="role-reason" />
    </ActionForm>
  );
}

function WorkspaceSelect({ workspaces, id = "workspaceId" }: { workspaces: UserPanelProps["workspaces"]; id?: string }) {
  const error = useFieldError("workspaceId");
  return (
    <Field label="Workspace" htmlFor={id} required error={error}>
      <Select id={id} name="workspaceId" required defaultValue={workspaces[0]?.id ?? ""}>
        {workspaces.length === 0 ? <option value="">No workspaces</option> : null}
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.isDemo ? " (demo)" : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function GrantCreditsForm({ user, workspaces }: { user: UserPanelProps["user"]; workspaces: UserPanelProps["workspaces"] }) {
  const amountError = useFieldError("amount");
  return (
    <ActionForm action={grantUserCreditsAction} hidden={{ userId: user.id }} submitLabel="Apply credits" submitVariant="secondary" resetOnSuccess className="space-y-3">
      <WorkspaceSelect workspaces={workspaces} id="credit-workspace" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount" htmlFor="credit-amount" required error={amountError} hint="Positive to add, negative to remove.">
          <Input id="credit-amount" name="amount" type="number" min={-500} max={500} step={1} defaultValue={5} required />
        </Field>
        <Field label="Type" htmlFor="credit-type">
          <Select id="credit-type" name="type" defaultValue="ADMIN_GRANT">
            <option value="ADMIN_GRANT">Admin grant</option>
            <option value="PROMOTIONAL">Promotional</option>
          </Select>
        </Field>
      </div>
      <ReasonField id="credit-reason" />
    </ActionForm>
  );
}

export function ComplimentaryPlanForm({ userId, workspaces, plans, defaultWorkspaceId }: { userId?: string; workspaces: UserPanelProps["workspaces"]; plans: UserPanelProps["plans"]; defaultWorkspaceId?: string }) {
  const untilError = useFieldError("until");
  const planError = useFieldError("planId");
  const min = timeAgo(-86_400_000).toISOString().slice(0, 10);
  return (
    <ActionForm action={applyComplimentaryPlanAction} hidden={userId ? { userId } : {}} submitLabel="Apply complimentary plan" submitVariant="secondary" className="space-y-3">
      {defaultWorkspaceId ? <input type="hidden" name="workspaceId" value={defaultWorkspaceId} /> : <WorkspaceSelect workspaces={workspaces} id="comp-workspace" />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan" htmlFor="comp-plan" required error={planError}>
          <Select id="comp-plan" name="planId" required defaultValue={plans[0]?.id ?? ""}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Until" htmlFor="comp-until" required error={untilError}>
          <Input id="comp-until" name="until" type="date" min={min} required />
        </Field>
      </div>
      <ReasonField id="comp-reason" />
    </ActionForm>
  );
}

export function DeleteUserPanel({ user }: { user: UserPanelProps["user"] }) {
  return (
    <ConfirmButton
      action={deleteUserAction}
      hidden={{ userId: user.id }}
      variant="destructive"
      disabled={user.isSelf}
      confirmTitle="Delete this account permanently?"
      confirmDescription="Workspaces solely owned by this user are deleted with all quotes, customers and files. Shared workspaces are transferred to another admin. This cannot be undone."
      confirmLabel="Delete account"
      typeToConfirm={user.email}
      reasonField={{ name: "reason", label: "Reason (required)", required: true }}
      redirectTo="/super-admin/users"
    >
      <Trash2 /> Delete account
    </ConfirmButton>
  );
}
