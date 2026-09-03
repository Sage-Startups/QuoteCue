"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWritableWorkspace } from "@/lib/auth";
import { archiveQuote, bulkArchiveQuotes, restoreQuote, duplicateQuote, createRevision, reactivateQuote, returnToDraft, createQuote, markReady } from "@/lib/services/quotes";
import { sendQuoteToCustomer, sendQuoteSchema, markLinkCopied } from "@/lib/services/quote-delivery";
import { rotatePublicLink } from "@/lib/services/public-quote";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors } from "@/lib/utils/zod-form";

export async function createQuoteAction(formData: FormData): Promise<void> {
  const ctx = await requireWritableWorkspace();
  const customerId = String(formData.get("customerId") ?? "");
  const quote = await createQuote({ workspaceId: ctx.workspace.id, userId: ctx.user.id, basics: customerId ? { customerId } : undefined });
  redirect(`/app/quotes/${quote.id}/edit?step=${customerId ? 2 : 1}`);
}

export async function archiveQuoteAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    await archiveQuote(ctx.workspace.id, String(formData.get("id")), ctx.user.id);
    revalidatePath("/app/quotes");
    return ok(undefined, "Quote archived");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function bulkArchiveAction(formData: FormData): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
    const count = await bulkArchiveQuotes(ctx.workspace.id, ids, ctx.user.id);
    revalidatePath("/app/quotes");
    return ok({ count }, `${count} quote${count === 1 ? "" : "s"} archived`);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function restoreQuoteAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    await restoreQuote(ctx.workspace.id, String(formData.get("id")), ctx.user.id);
    revalidatePath("/app/quotes");
    return ok(undefined, "Quote restored");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function duplicateQuoteAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const created = await duplicateQuote(ctx.workspace.id, String(formData.get("id")), ctx.user.id);
    revalidatePath("/app/quotes");
    return ok({ id: created.id }, `Duplicated as ${created.number}`);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function createRevisionAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    const result = await createRevision(ctx.workspace.id, id, ctx.user.id);
    revalidatePath(`/app/quotes/${id}`);
    return ok({ id }, `Revision ${result.versionNumber} created`);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function reactivateQuoteAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    const date = String(formData.get("expiresAt") ?? "");
    const expiry = date ? new Date(`${date}T23:59:59.999Z`) : new Date(Date.now() + 14 * 86_400_000);
    await reactivateQuote(ctx.workspace.id, id, ctx.user.id, expiry);
    revalidatePath(`/app/quotes/${id}`);
    return ok(undefined, "Quote reactivated");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function returnToDraftAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    await returnToDraft(ctx.workspace.id, id, ctx.user.id);
    revalidatePath(`/app/quotes/${id}`);
    return ok(undefined, "Quote returned to draft");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function markReadyAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    await markReady(ctx.workspace.id, id, ctx.user.id);
    revalidatePath(`/app/quotes/${id}`);
    return ok(undefined, "Marked ready to send");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function sendQuoteAction(_prev: ActionResult<{ link: string; previewMode: boolean }> | null, formData: FormData): Promise<ActionResult<{ link: string; previewMode: boolean }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    const parsed = sendQuoteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const result = await sendQuoteToCustomer(ctx.workspace.id, id, ctx.user.id, parsed.data);
    revalidatePath(`/app/quotes/${id}`);
    revalidatePath("/app/quotes");
    return ok({ link: result.link, previewMode: result.previewMode }, result.previewMode ? "Quote marked as sent. Email preview mode is on, so open the email from Email previews." : "Quote emailed to the customer");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function copyLinkAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    const link = await markLinkCopied(ctx.workspace.id, id, ctx.user.id);
    revalidatePath(`/app/quotes/${id}`);
    return ok({ url: link.url }, "Customer link ready");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function rotateLinkAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const id = String(formData.get("id"));
    const result = await rotatePublicLink(ctx.workspace.id, id, ctx.user.id);
    revalidatePath(`/app/quotes/${id}`);
    return ok({ url: result.url }, "A new customer link has been generated; the old link no longer works");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
