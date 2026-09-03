import type { Metadata } from "next";
import { Download, ListChecks, Copy, Archive, RotateCcw } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { listCatalogueItems, UNIT_LABELS } from "@/lib/services/catalogue";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils/money";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { ConfirmButton } from "@/components/app/confirm-button";
import { CatalogueItemDialog } from "@/components/catalogue/catalogue-item-dialog";
import { ImportCatalogueDialog } from "@/components/catalogue/import-dialog";
import { archiveCatalogueItemAction, duplicateCatalogueItemAction } from "./actions";

export const metadata: Metadata = { title: "Service catalogue" };

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; kind?: string; archived?: string; page?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app/catalogue");
  const [result, entitlements, settings] = await Promise.all([
    listCatalogueItems(ctx.workspace.id, { search: params.q, category: params.category, kind: params.kind === "LABOUR" || params.kind === "MATERIAL" || params.kind === "OTHER" ? params.kind : undefined, archived: params.archived === "1", page: Number(params.page ?? 1) }),
    getWorkspaceEntitlements(ctx.workspace.id),
    prisma.businessSettings.findUniqueOrThrow({ where: { workspaceId: ctx.workspace.id }, select: { currency: true } }),
  ]);
  const currency = settings.currency;
  const readOnly = !!ctx.supportSession;
  const margin = (price: number, cost: number) => (price > 0 ? Math.round(((price - cost) / price) * 100) : 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Service catalogue"
        description="Your services and rates. AI matches suggested work to these items and never invents a price."
        actions={
          readOnly ? null : (
            <>
              {entitlements.features.CSV_EXPORT ? (
                <Button asChild variant="secondary">
                  <a href="/app/catalogue/export">
                    <Download /> Export CSV
                  </a>
                </Button>
              ) : null}
              <ImportCatalogueDialog />
              <CatalogueItemDialog categories={result.categories} currency={currency} />
            </>
          )
        }
      />
      <SearchForm
        placeholder="Search services"
        query={params.q}
        filters={[
          { name: "category", label: "Category", value: params.category, options: [{ value: "", label: "All categories" }, ...result.categories.map((c) => ({ value: c, label: c }))] },
          { name: "kind", label: "Type", value: params.kind, options: [{ value: "", label: "All types" }, { value: "LABOUR", label: "Labour" }, { value: "MATERIAL", label: "Materials" }, { value: "OTHER", label: "Other" }] },
          { name: "archived", label: "Status", value: params.archived, options: [{ value: "", label: "Active" }, { value: "1", label: "Archived" }] },
        ]}
      />
      {result.items.length === 0 ? (
        <EmptyState icon={ListChecks} title="No services found" description={params.q ? "Try a different search." : "Add your first service or import a CSV of your rates."} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {result.items.map((item) => (
              <div key={item.id} className="rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category} · {item.kind.toLowerCase()} · per {UNIT_LABELS[item.unit].toLowerCase()}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular">{formatMoney(item.unitPriceMinor, currency)}</p>
                </div>
                {!readOnly ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <CatalogueItemDialog trigger="icon" categories={result.categories} currency={currency} initial={{ id: item.id, name: item.name, category: item.category, description: item.description ?? "", customerDescription: item.customerDescription ?? "", unit: item.unit, kind: item.kind, unitPrice: (item.unitPriceMinor / 100).toFixed(2), internalCost: (item.internalCostMinor / 100).toFixed(2), taxTreatment: item.taxTreatment, isActive: item.isActive }} />
                    <ConfirmButton action={duplicateCatalogueItemAction} hidden={{ id: item.id }} variant="ghost" size="sm">
                      <Copy /> Duplicate
                    </ConfirmButton>
                    <ConfirmButton action={archiveCatalogueItemAction} hidden={{ id: item.id, archived: item.archivedAt ? "false" : "true" }} variant="ghost" size="sm">
                      {item.archivedAt ? <RotateCcw /> : <Archive />} {item.archivedAt ? "Restore" : "Archive"}
                    </ConfirmButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-semibold">{item.name}</p>
                      {!item.isActive ? <Badge variant="muted">Inactive</Badge> : null}
                    </TableCell>
                    <TableCell>
                      {item.category}
                      <p className="text-xs text-muted-foreground">{item.kind.toLowerCase()}</p>
                    </TableCell>
                    <TableCell>{UNIT_LABELS[item.unit]}</TableCell>
                    <TableCell className="text-right tabular font-semibold">{formatMoney(item.unitPriceMinor, currency)}</TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">{formatMoney(item.internalCostMinor, currency)}</TableCell>
                    <TableCell className="text-right tabular">
                      <Badge variant={margin(item.unitPriceMinor, item.internalCostMinor) < 20 ? "warning" : "success"}>{margin(item.unitPriceMinor, item.internalCostMinor)}%</Badge>
                    </TableCell>
                    <TableCell>{item.taxTreatment === "TAXABLE" ? "Taxable" : "Exempt"}</TableCell>
                    <TableCell>
                      {!readOnly ? (
                        <div className="flex justify-end gap-1">
                          <CatalogueItemDialog trigger="icon" categories={result.categories} currency={currency} initial={{ id: item.id, name: item.name, category: item.category, description: item.description ?? "", customerDescription: item.customerDescription ?? "", unit: item.unit, kind: item.kind, unitPrice: (item.unitPriceMinor / 100).toFixed(2), internalCost: (item.internalCostMinor / 100).toFixed(2), taxTreatment: item.taxTreatment, isActive: item.isActive }} />
                          <ConfirmButton action={duplicateCatalogueItemAction} hidden={{ id: item.id }} variant="ghost" size="icon-sm" aria-label={`Duplicate ${item.name}`}>
                            <Copy />
                          </ConfirmButton>
                          <ConfirmButton action={archiveCatalogueItemAction} hidden={{ id: item.id, archived: item.archivedAt ? "false" : "true" }} variant="ghost" size="icon-sm" aria-label={item.archivedAt ? `Restore ${item.name}` : `Archive ${item.name}`}>
                            {item.archivedAt ? <RotateCcw /> : <Archive />}
                          </ConfirmButton>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={result.page} pages={result.pages} total={result.total} basePath="/app/catalogue" params={{ q: params.q, category: params.category, kind: params.kind, archived: params.archived }} />
        </>
      )}
    </div>
  );
}
