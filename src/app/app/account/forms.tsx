"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, Alert } from "@/components/ui/misc";
import { updateProfileAction, changePasswordAction } from "./actions";

export function ProfileForm({ name, email, locale }: { name: string; email: string; locale: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved");
  }, [state]);
  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="Full name" htmlFor="name" required error={err("name")}>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email-ro" hint="Contact support to change the email address on your account.">
        <Input id="email-ro" value={email} readOnly disabled />
      </Field>
      <Field label="Date and number format" htmlFor="locale">
        <Select id="locale" name="locale" defaultValue={locale}>
          <option value="en-GB">United Kingdom</option>
          <option value="en-IE">Ireland</option>
          <option value="en-US">United States</option>
          <option value="en-CA">Canada</option>
          <option value="en-AU">Australia</option>
          <option value="en-NZ">New Zealand</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Password changed");
  }, [state]);
  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="Current password" htmlFor="currentPassword" required error={err("currentPassword")}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="newPassword" required error={err("newPassword")} hint="At least 10 characters.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" required error={err("confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" loading={pending}>
        Change password
      </Button>
    </form>
  );
}
