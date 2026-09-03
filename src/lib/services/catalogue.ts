import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ServiceUnit } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { parseCsv, toCsv } from "@/lib/utils/csv";
import { parseMoneyToMinor } from "@/lib/utils/money";
import { NotFoundError } from "@/lib/utils/result";

export { UNIT_LABELS, UNIT_SHORT } from "@/lib/quotes/units";
import { UNIT_LABELS } from "@/lib/quotes/units";

export const catalogueItemSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").max(140),
  category: z.string().trim().min(1).max(60).default("General"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  customerDescription: z.string().trim().max(1000).optional().or(z.literal("")),
  unit: z.enum(["HOUR", "DAY", "ITEM", "METRE", "SQUARE_METRE", "VISIT", "FIXED"]),
  kind: z.enum(["LABOUR", "MATERIAL", "OTHER"]),
  unitPrice: z.coerce.number().min(0, "Price cannot be negative").max(10_000_000),
  internalCost: z.coerce.number().min(0).max(10_000_000).default(0),
  taxTreatment: z.enum(["TAXABLE", "EXEMPT"]).default("TAXABLE"),
  isActive: z.coerce.boolean().default(true),
});
export type CatalogueItemInput = z.infer<typeof catalogueItemSchema>;

function toData(input: CatalogueItemInput) {
  return {
    name: input.name,
    category: input.category || "General",
    description: input.description || null,
    customerDescription: input.customerDescription || null,
    unit: input.unit,
    kind: input.kind,
    unitPriceMinor: Math.round(input.unitPrice * 100),
    internalCostMinor: Math.round(input.internalCost * 100),
    taxTreatment: input.taxTreatment,
    isActive: input.isActive,
  };
}

export async function createCatalogueItem(workspaceId: string, input: CatalogueItemInput) {
  const max = await prisma.serviceCatalogueItem.aggregate({ where: { workspaceId }, _max: { sortOrder: true } });
  return prisma.serviceCatalogueItem.create({ data: { workspaceId, ...toData(input), sortOrder: (max._max.sortOrder ?? 0) + 1 }, select: { id: true } });
}

export async function updateCatalogueItem(workspaceId: string, itemId: string, input: CatalogueItemInput) {
  const result = await prisma.serviceCatalogueItem.updateMany({ where: { id: itemId, workspaceId }, data: toData(input) });
  if (result.count === 0) throw new NotFoundError("Catalogue item not found");
}

export async function setCatalogueItemArchived(workspaceId: string, itemId: string, archived: boolean) {
  const result = await prisma.serviceCatalogueItem.updateMany({
    where: { id: itemId, workspaceId },
    data: { archivedAt: archived ? new Date() : null, isActive: !archived },
  });
  if (result.count === 0) throw new NotFoundError("Catalogue item not found");
}

export async function duplicateCatalogueItem(workspaceId: string, itemId: string) {
  const item = await prisma.serviceCatalogueItem.findFirst({ where: { id: itemId, workspaceId } });
  if (!item) throw new NotFoundError("Catalogue item not found");
  const { id: _id, createdAt: _c, updatedAt: _u, archivedAt: _a, ...rest } = item;
  return prisma.serviceCatalogueItem.create({ data: { ...rest, name: `${item.name} (copy)`, sortOrder: item.sortOrder + 1 }, select: { id: true } });
}

export interface CatalogueListParams {
  search?: string;
  category?: string;
  kind?: "LABOUR" | "MATERIAL" | "OTHER";
  archived?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listCatalogueItems(workspaceId: string, params: CatalogueListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(5, params.pageSize ?? 50));
  const where: Prisma.ServiceCatalogueItemWhereInput = {
    workspaceId,
    archivedAt: params.archived ? { not: null } : null,
    category: params.category || undefined,
    kind: params.kind,
    OR: params.search
      ? [{ name: { contains: params.search, mode: "insensitive" } }, { description: { contains: params.search, mode: "insensitive" } }, { category: { contains: params.search, mode: "insensitive" } }]
      : undefined,
  };
  const [items, total, categories] = await Promise.all([
    prisma.serviceCatalogueItem.findMany({ where, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.serviceCatalogueItem.count({ where }),
    prisma.serviceCatalogueItem.findMany({ where: { workspaceId, archivedAt: null }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), categories: categories.map((c) => c.category) };
}

export async function searchCatalogueForPicker(workspaceId: string, query: string) {
  return prisma.serviceCatalogueItem.findMany({
    where: {
      workspaceId,
      archivedAt: null,
      isActive: true,
      OR: query ? [{ name: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }] : undefined,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 25,
    select: { id: true, name: true, category: true, unit: true, kind: true, unitPriceMinor: true, internalCostMinor: true, taxTreatment: true, customerDescription: true },
  });
}

export async function activeCatalogueForAi(workspaceId: string) {
  return prisma.serviceCatalogueItem.findMany({
    where: { workspaceId, archivedAt: null, isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, unit: true, kind: true },
    take: 200,
  });
}

export async function exportCatalogueCsv(workspaceId: string): Promise<string> {
  const items = await prisma.serviceCatalogueItem.findMany({ where: { workspaceId, archivedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return toCsv(
    items.map((i) => ({
      name: i.name,
      category: i.category,
      description: i.description ?? "",
      customer_description: i.customerDescription ?? "",
      unit: i.unit,
      kind: i.kind,
      unit_price: (i.unitPriceMinor / 100).toFixed(2),
      internal_cost: (i.internalCostMinor / 100).toFixed(2),
      tax_treatment: i.taxTreatment,
      active: i.isActive ? "yes" : "no",
    })),
    ["name", "category", "description", "customer_description", "unit", "kind", "unit_price", "internal_cost", "tax_treatment", "active"],
  );
}

export interface CsvImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

const UNIT_ALIASES: Record<string, ServiceUnit> = {
  hour: "HOUR",
  hr: "HOUR",
  hours: "HOUR",
  day: "DAY",
  days: "DAY",
  item: "ITEM",
  each: "ITEM",
  metre: "METRE",
  meter: "METRE",
  m: "METRE",
  "square metre": "SQUARE_METRE",
  "square meter": "SQUARE_METRE",
  sqm: "SQUARE_METRE",
  m2: "SQUARE_METRE",
  "m²": "SQUARE_METRE",
  visit: "VISIT",
  fixed: "FIXED",
  "fixed price": "FIXED",
};

export async function importCatalogueCsv(workspaceId: string, csvText: string): Promise<CsvImportResult> {
  const rows = parseCsv(csvText);
  const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  if (rows.length === 0) {
    result.errors.push({ row: 0, message: "The file has no data rows. Include a header row with at least name and unit_price." });
    return result;
  }
  if (rows.length > 500) {
    result.errors.push({ row: 0, message: "Imports are limited to 500 rows at a time." });
    return result;
  }
  const existing = await prisma.serviceCatalogueItem.findMany({ where: { workspaceId, archivedAt: null }, select: { id: true, name: true } });
  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e.id]));
  let sortOrder = existing.length;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNo = i + 2;
    try {
      const unitRaw = (row.unit ?? "item").toLowerCase().trim();
      const unit = UNIT_ALIASES[unitRaw] ?? (unitRaw.toUpperCase() as ServiceUnit);
      if (!Object.keys(UNIT_LABELS).includes(unit)) throw new Error(`Unknown unit "${row.unit}"`);
      const kindRaw = (row.kind ?? "labour").toUpperCase().trim();
      const kind = (["LABOUR", "MATERIAL", "OTHER"].includes(kindRaw) ? kindRaw : "LABOUR") as "LABOUR" | "MATERIAL" | "OTHER";
      const parsed = catalogueItemSchema.parse({
        name: row.name,
        category: row.category || "General",
        description: row.description ?? "",
        customerDescription: row.customer_description ?? "",
        unit,
        kind,
        unitPrice: parseMoneyToMinor(row.unit_price ?? row.price ?? "0") / 100,
        internalCost: parseMoneyToMinor(row.internal_cost ?? "0") / 100,
        taxTreatment: (row.tax_treatment ?? "TAXABLE").toUpperCase() === "EXEMPT" ? "EXEMPT" : "TAXABLE",
        isActive: !["no", "false", "0"].includes((row.active ?? "yes").toLowerCase()),
      });
      const existingId = byName.get(parsed.name.toLowerCase());
      if (existingId) {
        await prisma.serviceCatalogueItem.update({ where: { id: existingId }, data: toData(parsed) });
        result.updated++;
      } else {
        const created = await prisma.serviceCatalogueItem.create({ data: { workspaceId, ...toData(parsed), sortOrder: sortOrder++ }, select: { id: true } });
        byName.set(parsed.name.toLowerCase(), created.id);
        result.created++;
      }
    } catch (error) {
      result.skipped++;
      result.errors.push({ row: rowNo, message: error instanceof z.ZodError ? error.issues.map((iss) => iss.message).join("; ") : (error as Error).message });
    }
  }
  return result;
}
