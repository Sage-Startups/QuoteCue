"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Alert } from "@/components/ui/misc";
import type { ActionResult } from "@/lib/utils/result";
import { signUpAction, signInAction, forgotPasswordAction, resetPasswordAction, resendVerificationAction, magicLinkAction } from "@/app/(auth)/actions";

function useErrors(state: ActionResult<unknown> | null) {
  return (field: string) => (state && !state.ok ? state.fieldErrors?.[field] : undefined);
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, null);
  const err = useErrors(state);
  if (state?.ok) {
    return (
      <Alert variant="success" title="Check your email">
        {state.message}
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="Your name" htmlFor="name" required error={err("name")}>
        <Input id="name" name="name" autoComplete="name" required aria-invalid={!!err("name")} aria-describedby={err("name") ? "name-error" : undefined} />
      </Field>
      <Field label="Email" htmlFor="email" required error={err("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!err("email")} />
      </Field>
      <Field label="Password" htmlFor="password" required error={err("password")} hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} aria-invalid={!!err("password")} />
      </Field>
      <div className="flex items-start gap-3">
        <input id="terms" name="terms" type="checkbox" className="mt-1 size-4 rounded border-input accent-primary" required />
        <label htmlFor="terms" className="text-sm text-muted-foreground">
          I agree to the{" "}
          <Link href="/terms" className="font-medium text-foreground underline underline-offset-4">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
            privacy policy
          </Link>
          .
        </label>
      </div>
      {err("terms") ? <p className="text-xs font-medium text-destructive">{err("terms")?.[0]}</p> : null}
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Create my account
      </Button>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signInAction, null);
  const err = useErrors(state);
  useEffect(() => {
    if (state?.ok) {
      router.push(state.data.next);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="email" required error={err("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!err("email")} />
      </Field>
      <Field label="Password" htmlFor="password" required error={err("password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!err("password")} />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
          Forgotten password?
        </Link>
        <Link href="/magic-link" className="font-medium text-muted-foreground underline-offset-4 hover:underline">
          Email me a sign-in link
        </Link>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={pending || state?.ok === true}>
        Sign in
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  const err = useErrors(state);
  if (state?.ok) {
    return (
      <Alert variant="success" title="Check your email">
        {state.message}
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="email" required error={err("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  const err = useErrors(state);
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Alert variant="success" title="Password changed">
          {state.message}
        </Alert>
        <Button asChild className="w-full" size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="New password" htmlFor="password" required error={err("password")} hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" required error={err("confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

export function ResendVerificationForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(resendVerificationAction, null);
  const err = useErrors(state);
  const [email, setEmail] = useState(defaultEmail ?? "");
  if (state?.ok) {
    return (
      <Alert variant="success" title="Sent">
        {state.message}
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="email" required error={err("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Button type="submit" variant="secondary" className="w-full" loading={pending}>
        Resend verification email
      </Button>
    </form>
  );
}

export function MagicLinkForm() {
  const [state, action, pending] = useActionState(magicLinkAction, null);
  const err = useErrors(state);
  if (state?.ok) {
    return (
      <Alert variant="success" title="Check your email">
        {state.message}
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="email" required error={err("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Email me a sign-in link
      </Button>
    </form>
  );
}
