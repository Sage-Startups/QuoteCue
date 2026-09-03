import { getDemoWorkspace } from "@/lib/services/demo";
import { listCustomers, customerDisplayName } from "@/lib/services/customers";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function DemoCustomersPage() {
  const demo = (await getDemoWorkspace())!;
  const result = await listCustomers(demo.id, { pageSize: 50 });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Demonstration data" title="Customers" description={`${result.total} sample customers with fictional contact details.`} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {result.items.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <p className="font-semibold">{customerDisplayName(c)}</p>
              <p className="text-sm text-muted-foreground">{c.email}</p>
              <p className="text-sm text-muted-foreground">{[c.jobAddressLine1, c.jobCity, c.jobPostalCode].filter(Boolean).join(", ")}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="secondary">{c._count.quotes} quotes</Badge>
                {c.tags.map((t) => (
                  <Badge key={t.tagId} variant="outline">
                    {t.tag.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
