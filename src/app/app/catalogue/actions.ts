"use server";

import { revalidatePath } from "next/cache";
import { requireWritableWorkspace, requireWorkspace } from "@/lib/auth";
import { catalogueItemSchema, createCatalogueItem, updateCatalogueItem, setCatalogueItemArchived, duplicateCatalogueItem, importCatalogueCsv, searchCatalogueForPicker, type CsvImportResult } from "@/lib/services/catalogue";
import { assertFeature } from "@/lib/billing/entitlements";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { zodFieldErrors, formDataToObject } from "@/lib/utils/zod-form";

export async function saveCatalogueItemAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireWritableWorkspace();
    const raw = formDataToObject(formData);
    raw.isActive = formData.get("isActive") === "on";
    const parsed = catalogueItemSchema.safeParse(raw);
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const id = String(formData.get("id") ?? "");
    if (id) {
      await updateCatalogueItem(ctx.workspace.id, id, parsed.data);
      revalidatePath("/app/catalogue");
      return ok({ id }, "Item updated");
    }
    const created = await createCatalogueItem(ctx.workspace.id, parsed.data);
    revalidatePath("/app/catalogue");
    return ok({ id: created.id }, "Item added");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function archiveCatalogueItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    const archived = formData.get("archived") !== "false";
    await setCatalogueItemArchived(ctx.workspace.id, String(formData.get("id")), archived);
    revalidatePath("/app/catalogue");
    return ok(undefined, archived ? "Item archived" : "Item restored");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function duplicateCatalogueItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireWritableWorkspace();
    await duplicateCatalogueItem(ctx.workspace.id, String(formData.get("id")));
    revalidatePath("/app/catalogue");
    return ok(undefined, "Item duplicated");
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function importCatalogueAction(_prev: ActionResult<CsvImportResult> | null, formData: FormData): Promise<ActionResult<CsvImportResult>> {
  try {
    const ctx = await requireWritableWorkspace();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file to import.");
    if (file.size > 2 * 1024 * 1024) return fail("CSV files must be under 2 MB.");
    const text = await file.text();
    const result = await importCatalogueCsv(ctx.workspace.id, text);
    revalidatePath("/app/catalogue");
    return ok(result, `Imported ${result.created} new and updated ${result.updated} items${result.skipped ? ` (${result.skipped} skipped)` : ""}.`);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function searchCatalogueAction(query: string) {
  const ctx = await requireWorkspace();
  return searchCatalogueForPicker(ctx.workspace.id, query.slice(0, 80));
}

export async function checkExportEntitlementAction(): Promise<ActionResult> {
  try {
    const ctx = await requireWorkspace();
    await assertFeature(ctx.workspace.id, "CSV_EXPORT");
    return ok(undefined);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
