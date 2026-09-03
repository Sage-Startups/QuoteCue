"use client";

import { Eye } from "lucide-react";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { Field } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/textarea";
import { viewPrivateQuoteAction } from "../actions";

export function RevealPrivateContentForm({ quoteId }: { quoteId: string }) {
  const error = useFieldError("reason");
  return (
    <ActionForm
      action={viewPrivateQuoteAction}
      hidden={{ quoteId }}
      submitLabel={
        <>
          <Eye /> View private content
        </>
      }
      submitVariant="secondary"
      className="space-y-3"
    >
      <Field label="Reason for access" htmlFor="reveal-reason" required error={error} hint="Recorded in the audit log and added to the quote's activity history, where the workspace can see it.">
        <Textarea id="reveal-reason" name="reason" rows={2} required minLength={5} maxLength={500} placeholder="e.g. Customer reported that the AI analysis missed the second bathroom" />
      </Field>
    </ActionForm>
  );
}
