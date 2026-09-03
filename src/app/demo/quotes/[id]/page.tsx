import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getDemoWorkspace } from "@/lib/services/demo";
import { getQuote, getQuoteEvents } from "@/lib/services/quotes";
import { buildQuoteDocument } from "@/lib/services/quote-document";
import { customerDisplayName } from "@/lib/services/customers";
import { formatMoney } from "@/lib/utils/money";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { ActivityFeed } from "@/components/app/activity-feed";
import { QuotePreview } from "@/components/quotes/quote-preview";

export default async function DemoQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const demo = (await getDemoWorkspace())!;
  const quote = await getQuote(demo.id, id).catch(() => null);
  if (!quote) notFound();
  const [document, events] = await Promise.all([buildQuoteDocument(demo.id, id), getQuoteEvents(demo.id, id)]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={quote.number}
        title={quote.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} />
            <span>
              {quote.customer ? customerDisplayName(quote.customer) : "—"} · {formatMoney(quote.totalMinor, quote.currency)}
            </span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/demo/customer-view/${quote.id}`}>
                <Eye /> See the customer view
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/demo/quotes">Back to quotes</Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuotePreview data={document} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed showQuote={false} items={events.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt, actorName: e.actorUser?.name ?? (e.actorType === "CUSTOMER" ? "Customer" : null) }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Original enquiry</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{quote.enquiryText}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
