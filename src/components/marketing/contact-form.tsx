"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, Field } from "@/components/ui/misc";
import type { ActionResult } from "@/lib/utils/result";

type ContactAction = (state: ActionResult<undefined> | null, formData: FormData) => Promise<ActionResult<undefined>>;

export function ContactForm({ action: submit }: { action: ContactAction }) {
  const [state, action, pending] = useActionState(submit, null);
  const err = (field: string) => (state && !state.ok ? state.fieldErrors?.[field] : undefined);

  if (state?.ok) {
    return (
      <Alert variant="success" title="Message sent">
        {state.message ?? "Thanks. We will reply by email as soon as we can."}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="contact-name" required error={err("name")}>
          <Input id="contact-name" name="name" autoComplete="name" required maxLength={120} aria-invalid={!!err("name")} aria-describedby={err("name") ? "contact-name-error" : undefined} />
        </Field>
        <Field label="Email" htmlFor="contact-email" required error={err("email")}>
          <Input id="contact-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={200} aria-invalid={!!err("email")} aria-describedby={err("email") ? "contact-email-error" : undefined} />
        </Field>
      </div>
      <Field label="Company" htmlFor="contact-company" error={err("company")} hint="Optional">
        <Input id="contact-company" name="company" autoComplete="organization" maxLength={120} aria-invalid={!!err("company")} aria-describedby={err("company") ? "contact-company-error" : "contact-company-hint"} />
      </Field>
      <Field label="Message" htmlFor="contact-message" required error={err("message")} hint="Tell us what you need help with. Please do not include passwords or payment details.">
        <Textarea id="contact-message" name="message" required minLength={10} maxLength={4000} rows={6} aria-invalid={!!err("message")} aria-describedby={err("message") ? "contact-message-error" : "contact-message-hint"} />
      </Field>
      {/* Honeypot: hidden from people, filled by naive bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  );
}
