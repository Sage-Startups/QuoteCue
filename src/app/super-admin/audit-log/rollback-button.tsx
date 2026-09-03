"use client";

import { Undo2 } from "lucide-react";
import { ConfirmButton } from "@/components/app/confirm-button";
import { rollbackAuditEntryAction } from "./actions";

export function RollbackButton({ entryId, target }: { entryId: string; target: string }) {
  return (
    <ConfirmButton action={rollbackAuditEntryAction} hidden={{ entryId }} variant="outline" size="sm" confirmTitle={`Roll back ${target}?`} confirmDescription="The previous value recorded on this entry is re-applied and validated. The rollback is itself recorded in the audit log." confirmLabel="Roll back">
      <Undo2 /> Rollback
    </ConfirmButton>
  );
}
