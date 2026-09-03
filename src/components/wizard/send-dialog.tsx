"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/utils/result";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Alert } from "@/components/ui/misc";
import { sendQuoteAction } from "@/app/app/quotes/actions";

export function SendQuoteDialog({ open, onOpenChange, quoteId, defaultEmail, defaultMessage, emailPreviewMode, onSent }: { open: boolean; onOpenChange: (o: boolean) => void; quoteId: string; defaultEmail: string; defaultMessage: string; emailPreviewMode: boolean; onSent?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: ActionResult<{ link: string; previewMode: boolean }> | null, fd: FormData) => {
    const result = await sendQuoteAction(prev, fd);
    if (result.ok) {
      toast.success(result.message ?? "Sent");
      onOpenChange(false);
      onSent?.();
      router.refresh();
    }
    return result;
  }, null);
  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Email the quote</DialogTitle>
          <DialogDescription>The customer receives a link to view, download, accept or decline the quote. The PDF is regenerated before sending.</DialogDescription>
        </DialogHeader>
        {emailPreviewMode ? <Alert variant="warning">Email preview mode: nothing is delivered. The email will be stored under Email previews for you to inspect.</Alert> : null}
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={quoteId} />
          {state && !state.ok ? <Alert variant="destructive">{state.error}</Alert> : null}
          <Field label="Send to" htmlFor="toEmail" required error={err("toEmail")}>
            <Input id="toEmail" name="toEmail" type="email" defaultValue={defaultEmail} required />
          </Field>
          <Field label="Message" htmlFor="message" error={err("message")} hint="[QUOTE LINK] is replaced with the secure link.">
            <Textarea id="message" name="message" defaultValue={defaultMessage} rows={8} />
          </Field>
          <Field label="Remind me to follow up in (days)" htmlFor="followUpDays">
            <Input id="followUpDays" name="followUpDays" type="number" min={1} max={60} defaultValue={3} className="max-w-[8rem]" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              <Mail /> Send quote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
