"use server";

import { revalidatePath } from "next/cache";
import { requireWritableWorkspace } from "@/lib/auth";
import { customerSchema, createCustomer, updateCustomer, setCustomerArchived, findPossibleDuplicates, searchCustomersForPicker } from "@/lib/services/customers";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors, formDataToObject } from "@/lib/utils/zod-form";

function parseForm(formData: FormData) {
  const raw = formDataToObject(formData);
  raw.jobAddressSameAsBilling = formData.get("jobAddressSameAsBilling") === "on";
  raw.tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return customerSchema.safeParse(raw);
}

export async function createCustomerAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const parsed = parseForm(formData);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const customer = await createCustomer(ctx.workspace.id, parsed.data);
    revalidatePath("/app/customers");
    return ok({ id: customer.id }, "Customer created");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function updateCustomerAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id") ?? "");
    const parsed = parseForm(formData);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await updateCustomer(ctx.workspace.id, id, parsed.data);
    revalidatePath("/app/customers");
    revalidatePath(`/app/customers/${id}`);
    return ok({ id }, "Customer updated");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function archiveCustomerAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id") ?? "");
    const archived = formData.get("archived") !== "false";
    await setCustomerArchived(ctx.workspace.id, id, archived);
    revalidatePath("/app/customers");
    return ok(undefined, archived ? "Customer archived" : "Customer restored");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function checkDuplicateCustomerAction(input: { email?: string; phone?: string; excludeId?: string }): Promise<Array<{ id: string; contactName: string; companyName: string | null; email: string | null; phone: string | null }>> {
  const ctx = await requireWritableWorkspace();
  return findPossibleDuplicates(ctx.workspace.id, input.email, input.phone, input.excludeId);
}

export async function searchCustomersAction(query: string) {
  const ctx = await requireWritableWorkspace();
  return searchCustomersForPicker(ctx.workspace.id, query.slice(0, 80));
}

/** Creates a customer from the quote wizard's quick form. */
export async function quickCreateCustomerAction(input: { contactName: string; companyName?: string; email?: string; phone?: string; jobAddressLine1?: string; jobCity?: string; jobPostalCode?: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const parsed = customerSchema.safeParse({
      type: input.companyName ? "COMPANY" : "INDIVIDUAL",
      contactName: input.contactName,
      companyName: input.companyName ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
      jobAddressSameAsBilling: true,
      billingAddressLine1: input.jobAddressLine1 ?? "",
      billingCity: input.jobCity ?? "",
      billingPostalCode: input.jobPostalCode ?? "",
      tags: [],
    });
    if (!parsed.success) return fail("Please check the customer details.", zodFieldErrors(parsed.error));
    const customer = await createCustomer(ctx.workspace.id, parsed.data);
    return ok({ id: customer.id }, "Customer created");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
