"use client";

import { RotateCcw } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/app/confirm-button";
import { StructuredEditor, type JsonValue } from "@/components/admin/structured-editor";
import { resetMarketingContentAction, saveMarketingContentAction } from "../actions";

export function MarketingSectionEditor({ sectionKey, initial, customised }: { sectionKey: string; initial: JsonValue; customised: boolean }) {
  return (
    <div className="space-y-4">
      <ActionForm
        action={saveMarketingContentAction}
        hidden={{ key: sectionKey }}
        submitLabel="Save and publish"
        footer={
          <ConfirmButton action={resetMarketingContentAction} hidden={{ key: sectionKey }} variant="ghost" disabled={!customised} confirmTitle="Reset this section to the defaults?" confirmDescription="Your customised copy is replaced with the built-in defaults and published immediately." confirmLabel="Reset">
            <RotateCcw /> Reset to defaults
          </ConfirmButton>
        }
      >
        <StructuredEditor key={JSON.stringify(initial)} initial={initial} idPrefix={sectionKey.replace(/\W/g, "-")} />
      </ActionForm>
    </div>
  );
}
