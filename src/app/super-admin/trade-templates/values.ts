import { minorToDecimalString } from "@/components/admin/format";
import type { ServiceRow } from "./schema";
import type { TradeTemplateFormValues } from "./template-form";

interface TemplateRow {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  defaultScope: string | null;
  defaultTerms: string | null;
  commonExclusions: unknown;
  commonQuestions: unknown;
  defaultAssumptions: unknown;
  suggestedServices: unknown;
}

function lines(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join("\n") : "";
}

export function templateToFormValues(t: TemplateRow): TradeTemplateFormValues {
  const services: ServiceRow[] = Array.isArray(t.suggestedServices)
    ? (t.suggestedServices as Array<Record<string, unknown>>).map((s) => ({
        name: String(s.name ?? ""),
        category: String(s.category ?? "General"),
        unit: (s.unit as ServiceRow["unit"]) ?? "ITEM",
        kind: (s.kind as ServiceRow["kind"]) ?? "LABOUR",
        unitPrice: minorToDecimalString(Number(s.unitPriceMinor ?? 0)),
        internalCost: minorToDecimalString(Number(s.internalCostMinor ?? 0)),
        customerDescription: String(s.customerDescription ?? ""),
      }))
    : [];
  return {
    slug: t.slug,
    name: t.name,
    description: t.description ?? "",
    icon: t.icon ?? "",
    isActive: t.isActive,
    sortOrder: t.sortOrder,
    defaultScope: t.defaultScope ?? "",
    defaultTerms: t.defaultTerms ?? "",
    commonExclusions: lines(t.commonExclusions),
    commonQuestions: lines(t.commonQuestions),
    defaultAssumptions: lines(t.defaultAssumptions),
    suggestedServices: services,
  };
}

export const EMPTY_TEMPLATE: TradeTemplateFormValues = { slug: "", name: "", description: "", icon: "wrench", isActive: true, sortOrder: 50, defaultScope: "", defaultTerms: "", commonExclusions: "", commonQuestions: "", defaultAssumptions: "", suggestedServices: [] };
