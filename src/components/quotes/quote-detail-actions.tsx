"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Link2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendQuoteDialog } from "@/components/wizard/send-dialog";
import { copyLinkAction, rotateLinkAction } from "@/app/app/quotes/actions";
import type { QuoteStatus } from "@/generated/prisma/enums";

export function QuoteDetailActions({ quoteId, status, customerEmail, followUpEmail, emailPreviewMode, publicUrl, canSend }: { quoteId: string; status: QuoteStatus; customerEmail: string; followUpEmail: string; emailPreviewMode: boolean; publicUrl: string | null; canSend: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const sendable = canSend && !["ACCEPTED", "ARCHIVED"].includes(status);
  const copy = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", quoteId);
      const result = await copyLinkAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.data.url);
        toast.success("Customer link copied");
      } catch {
        toast.success(`Customer link: ${result.data.url}`);
      }
      router.refresh();
    });
  const rotate = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", quoteId);
      const result = await rotateLinkAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Link rotated");
      router.refresh();
    });
  return (
    <>
      {sendable ? (
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Mail /> {status === "SENT" || status === "VIEWED" || status === "EXPIRED" || status === "DECLINED" ? "Resend by email" : "Send by email"}
        </Button>
      ) : null}
      {sendable ? (
        <Button variant="secondary" onClick={copy} loading={pending}>
          <Link2 /> Copy customer link
        </Button>
      ) : null}
      {publicUrl ? (
        <Button variant="ghost" onClick={rotate} loading={pending}>
          <RotateCw /> Rotate customer link
        </Button>
      ) : null}
      <SendQuoteDialog open={open} onOpenChange={setOpen} quoteId={quoteId} defaultEmail={customerEmail} defaultMessage={followUpEmail} emailPreviewMode={emailPreviewMode} />
    </>
  );
}
