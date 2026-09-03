import Link from "next/link";
import { notFound } from "next/navigation";
import { getDemoWorkspace } from "@/lib/services/demo";
import { buildQuoteDocument } from "@/lib/services/quote-document";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { QuotePreview } from "@/components/quotes/quote-preview";

export default async function DemoCustomerViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const demo = (await getDemoWorkspace())!;
  const document = await buildQuoteDocument(demo.id, id).catch(() => null);
  if (!document) notFound();
  const total = formatMoney(document.totals.totalMinor, document.quote.currency);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Alert variant="info" title="This is what your customer sees">
        Customers open quotes from a secure link, download the PDF and accept by typing their name. In the demo the buttons are disabled.
      </Alert>
      <QuotePreview data={document} />
      <section className="rounded-xl border bg-white p-5 shadow-card">
        <h2 className="text-lg font-bold">Your decision</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Total {total}. Valid until {formatDate(document.quote.expiresAt)}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" variant="success" disabled>
            Accept quote ({total})
          </Button>
          <Button size="lg" variant="secondary" disabled>
            Decline
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Acceptance is disabled in the demo.</p>
      </section>
      <div className="text-center">
        <Button asChild variant="ghost">
          <Link href={`/demo/quotes/${id}`}>Back to the quote</Link>
        </Button>
      </div>
    </div>
  );
}
