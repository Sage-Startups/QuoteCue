"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, Alert } from "@/components/ui/misc";
import { inviteMemberAction } from "./actions";

export function InviteForm({ disabled, remaining }: { disabled: boolean; remaining: number }) {
  const [state, action, pending] = useActionState(inviteMemberAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Invitation sent");
      ref.current?.reset();
    }
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <Field label="Email" htmlFor="invite-email" required error={state && !state.ok ? state.fieldErrors?.email : undefined} className="flex-1">
        <Input id="invite-email" name="email" type="email" inputMode="email" required disabled={disabled} />
      </Field>
      <Field label="Role" htmlFor="invite-role" className="sm:w-44">
        <Select id="invite-role" name="role" defaultValue="MEMBER" disabled={disabled}>
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending} disabled={disabled}>
        Send invitation
      </Button>
      {state && !state.ok && !state.fieldErrors ? <Alert variant="destructive" className="sm:basis-full">{state.error}</Alert> : null}
      {remaining <= 0 ? <p className="text-xs text-muted-foreground sm:basis-full">No seats left on your plan.</p> : null}
    </form>
  );
}
