import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { listCustomers, listCustomerTags, customerDisplayName } from "@/lib/services/customers";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchForm } from "@/components/app/search-form";
import { Pagination } from "@/components/app/pagination";
import { formatRelative } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; type?: string; archived?: string; page?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app/customers");
  const [result, tags] = await Promise.all([
    listCustomers(ctx.workspace.id, { search: params.q, tag: params.tag, type: params.type === "COMPANY" || params.type === "INDIVIDUAL" ? params.type : undefined, archived: params.archived === "1", page: Number(params.page ?? 1) }),
    listCustomerTags(ctx.workspace.id),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${result.total} ${params.archived === "1" ? "archived" : "active"} customer${result.total === 1 ? "" : "s"}`}
        actions={
          <Button asChild>
            <Link href="/app/customers/new">Add customer</Link>
          </Button>
        }
      />
      <SearchForm
        placeholder="Search name, company, email, phone or postcode"
        query={params.q}
        filters={[
          { name: "type", label: "Type", value: params.type, options: [{ value: "", label: "All types" }, { value: "INDIVIDUAL", label: "Individuals" }, { value: "COMPANY", label: "Companies" }] },
          { name: "tag", label: "Tag", value: params.tag, options: [{ value: "", label: "All tags" }, ...tags.map((t) => ({ value: t.name, label: `${t.name} (${t._count.assignments})` }))] },
          { name: "archived", label: "Status", value: params.archived, options: [{ value: "", label: "Active" }, { value: "1", label: "Archived" }] },
        ]}
      />
      {result.items.length === 0 ? (
        <EmptyState icon={Users} title={params.q || params.tag ? "No customers match" : "No customers yet"} description={params.q || params.tag ? "Try a different search or filter." : "Add your first customer or create one directly from the quote wizard."} action={{ label: "Add customer", href: "/app/customers/new" }} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {result.items.map((c) => (
              <Link key={c.id} href={`/app/customers/${c.id}`} className="block rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{customerDisplayName(c)}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.email ?? c.phone ?? "No contact details"}</p>
                  </div>
                  <Badge variant="secondary">{c._count.quotes} quotes</Badge>
                </div>
                {c.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Badge key={t.tagId} variant="outline">
                        {t.tag.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/app/customers/${c.id}`} className="font-semibold hover:underline">
                        {customerDisplayName(c)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{[c.jobCity, c.jobPostalCode].filter(Boolean).join(" ")}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{c.email ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.phone ?? ""}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <Badge key={t.tagId} variant="outline">
                            {t.tag.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular">{c._count.quotes}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatRelative(c.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={result.page} pages={result.pages} total={result.total} basePath="/app/customers" params={{ q: params.q, tag: params.tag, type: params.type, archived: params.archived }} />
        </>
      )}
    </div>
  );
}
