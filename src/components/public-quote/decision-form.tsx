"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Alert } from "@/components/ui/misc";
import { customerDecisionAction } from "@/app/q/[token]/actions";

export function DecisionForm({ token, businessName, total }: { token: string; businessName: string; total: string }) {
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [state, action, pending] = useActionState(customerDecisionAction, null);
  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
  if (state?.ok) {
    return (
      <Alert variant={state.data.decision === "ACCEPTED" ? "success" : "info"} title={state.data.decision === "ACCEPTED" ? "Quote accepted" : "Quote declined"}>
        {state.data.decision === "ACCEPTED" ? `Thank you. ${businessName} has been notified and will be in touch to arrange the work.` : `Thanks for letting us know. ${businessName} has been notified.`}
      </Alert>
    );
  }
  return (
    <div className="space-y-4" id="decision">
      {mode === "idle" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" variant="success" onClick={() => setMode("accept")}>
            <CheckCircle2 /> Accept quote ({total})
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setMode("decline")}>
            <XCircle /> Decline
          </Button>
        </div>
      ) : null}
      {mode === "accept" ? (
        <form action={action} className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-4" noValidate>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="decision" value="ACCEPTED" />
          <h3 className="font-semibold">Accept this quote</h3>
          {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
          <Field label="Your full name" htmlFor="signedName" required error={err("signedName")} hint="Typing your name acts as your signature.">
            <Input id="signedName" name="signedName" autoComplete="name" required className="bg-white" />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="termsAccepted" required className="mt-1 size-4 accent-primary" />
            <span>I have read the quote and agree to the scope, assumptions, exclusions and payment terms set out above.</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" size="lg" variant="success" loading={pending}>
              Confirm acceptance
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </form>
      ) : null}
      {mode === "decline" ? (
        <form action={action} className="space-y-4 rounded-xl border bg-muted/40 p-4" noValidate>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="decision" value="DECLINED" />
          <h3 className="font-semibold">Decline this quote</h3>
          {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
          <Field label="Reason (optional)" htmlFor="reason" error={err("reason")} hint="Helps the business understand what to change.">
            <Textarea id="reason" name="reason" rows={3} className="bg-white" />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" size="lg" variant="destructive" loading={pending}>
              Confirm decline
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
