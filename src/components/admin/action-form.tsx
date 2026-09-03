"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import type { ActionResult } from "@/lib/utils/result";

type FormAction<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

const FormStateContext = React.createContext<ActionResult<unknown> | null>(null);

/** Reads the field error for `name` from the nearest ActionForm result. */
export function useFieldError(name: string): string | undefined {
  const state = React.useContext(FormStateContext);
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[name]?.[0];
}

export interface ActionFormProps<T> extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit" | "hidden"> {
  action: FormAction<T>;
  hidden?: Record<string, string>;
  submitLabel?: React.ReactNode;
  submitVariant?: ButtonProps["variant"];
  submitSize?: ButtonProps["size"];
  submitClassName?: string;
  /** Called after a successful result (after the toast and refresh). */
  onSuccess?: (data: T) => void;
  /** Reset the form fields after a successful submission. */
  resetOnSuccess?: boolean;
  successMessage?: string;
  showSuccessAlert?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Generic `useActionState` form for admin mutations. Side effects (toast,
 * router refresh) run inside the action wrapper rather than in an effect.
 */
export function ActionForm<T>({ action, hidden = {}, submitLabel = "Save", submitVariant, submitSize, submitClassName, onSuccess, resetOnSuccess, successMessage, showSuccessAlert, children, footer, className, ...formProps }: ActionFormProps<T>) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult<T> | null, FormData>(async (prev, formData) => {
    for (const [k, v] of Object.entries(hidden)) formData.set(k, v);
    const result = await action(prev, formData);
    if (result.ok) {
      toast.success(successMessage ?? result.message ?? "Saved");
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(result.data);
      router.refresh();
    } else if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      toast.error(result.error);
    }
    return result;
  }, null);

  return (
    <FormStateContext.Provider value={state}>
      <form ref={formRef} action={formAction} className={className} noValidate {...formProps}>
        {state && !state.ok ? (
          <Alert variant="destructive" className="mb-4">
            {state.error}
          </Alert>
        ) : null}
        {state && state.ok && showSuccessAlert ? (
          <Alert variant="success" className="mb-4">
            {state.message ?? "Saved"}
          </Alert>
        ) : null}
        {children}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="submit" loading={pending} variant={submitVariant} size={submitSize} className={submitClassName}>
            {submitLabel}
          </Button>
          {footer}
        </div>
      </form>
    </FormStateContext.Provider>
  );
}
