"use client";

import { RefreshCw, XCircle, RotateCcw } from "lucide-react";
import { ConfirmButton } from "@/components/app/confirm-button";
import { ActionForm, useFieldError } from "@/components/admin/action-form";
import { Field } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { changePlanMappingAction, reconcileSubscriptionAction, setCancelAtPeriodEndAction } from "../actions";

export function SubscriptionQuickActions({ workspaceId, cancelAtPeriodEnd, hasStripeSubscription, stripeConfigured }: { workspaceId: string; cancelAtPeriodEnd: boolean; hasStripeSubscription: boolean; stripeConfigured: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {cancelAtPeriodEnd ? (
        <ConfirmButton action={setCancelAtPeriodEndAction} hidden={{ workspaceId, cancel: "false" }} variant="default" confirmTitle="Restore this subscription?" confirmDescription="The subscription will renew at the end of the current period." confirmLabel="Restore">
          <RotateCcw /> Restore subscription
        </ConfirmButton>
      ) : (
        <ConfirmButton action={setCancelAtPeriodEndAction} hidden={{ workspaceId, cancel: "true" }} variant="outline" confirmTitle="Cancel at period end?" confirmDescription="The workspace keeps access until the end of the current billing period. Purchased credits are kept." confirmLabel="Cancel at period end">
          <XCircle /> Cancel at period end
        </ConfirmButton>
      )}
      <ConfirmButton action={reconcileSubscriptionAction} hidden={{ workspaceId }} variant="secondary" disabled={!stripeConfigured || !hasStripeSubscription} title={!stripeConfigured ? "Stripe is not configured" : !hasStripeSubscription ? "No Stripe subscription linked" : undefined}>
        <RefreshCw /> Reconcile with Stripe
      </ConfirmButton>
    </div>
  );
}

export function ChangePlanForm({ workspaceId, currentPlanId, plans }: { workspaceId: string; currentPlanId: string; plans: Array<{ id: string; name: string }> }) {
  const planError = useFieldError("planId");
  const reasonError = useFieldError("reason");
  return (
    <ActionForm action={changePlanMappingAction} hidden={{ workspaceId }} submitLabel="Change plan mapping" submitVariant="secondary" className="space-y-3">
      <Field label="Plan" htmlFor="map-plan" required error={planError} hint="Only changes the local mapping; Stripe is not modified. Use this to correct a mismatch.">
        <Select id="map-plan" name="planId" defaultValue={currentPlanId} required>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason" htmlFor="map-reason" required error={reasonError} hint="Recorded in the audit log.">
        <Textarea id="map-reason" name="reason" rows={2} required minLength={5} maxLength={500} />
      </Field>
    </ActionForm>
  );
}
