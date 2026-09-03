"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/utils/result";

interface ConfirmButtonProps extends Omit<ButtonProps, "onClick" | "hidden"> {
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  hidden?: Record<string, string>;
  confirmTitle?: string;
  confirmDescription?: React.ReactNode;
  confirmLabel?: string;
  /** When set, the user must type this text to confirm. */
  typeToConfirm?: string;
  reasonField?: { name: string; label: string; required?: boolean };
  onSuccess?: (data: unknown) => void;
  successMessage?: string;
  redirectTo?: string;
}

/** Submits a server action, optionally after a confirmation dialog, and shows a toast with the outcome. */
export function ConfirmButton({ action, hidden = {}, confirmTitle, confirmDescription, confirmLabel = "Confirm", typeToConfirm, reasonField, onSuccess, successMessage, redirectTo, children, ...buttonProps }: ConfirmButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
    if (reasonField) fd.set(reasonField.name, reason);
    startTransition(async () => {
      const result = await action(fd);
      if (result.ok) {
        toast.success(successMessage ?? result.message ?? "Done");
        setOpen(false);
        onSuccess?.(result.data);
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const needsDialog = !!confirmTitle;
  return (
    <>
      <Button {...buttonProps} loading={pending} onClick={() => (needsDialog ? setOpen(true) : run())}>
        {children}
      </Button>
      {needsDialog ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmTitle}</DialogTitle>
              {confirmDescription ? <DialogDescription>{confirmDescription}</DialogDescription> : null}
            </DialogHeader>
            {reasonField ? (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-reason" required={reasonField.required}>
                  {reasonField.label}
                </Label>
                <Input id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            ) : null}
            {typeToConfirm ? (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-typed">
                  Type <span className="font-mono">{typeToConfirm}</span> to confirm
                </Label>
                <Input id="confirm-typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant={buttonProps.variant === "destructive" ? "destructive" : "default"} loading={pending} disabled={(typeToConfirm !== undefined && typed !== typeToConfirm) || (reasonField?.required && reason.trim().length < 3)} onClick={run}>
                {confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
