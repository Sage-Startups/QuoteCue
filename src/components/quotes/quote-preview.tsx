import type { QuoteDocumentData } from "@/lib/services/quote-document";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { splitLines } from "@/lib/utils/strings";
import { UNIT_SHORT } from "@/lib/quotes/units";
import { cn } from "@/lib/utils/cn";
import type { ServiceUnit } from "@/generated/prisma/enums";

function Section({ title, content }: { title: string; content: string | null }) {
  if (!content?.trim()) return null;
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const isList = lines.every((l) => /^\s*[-*•]\s+/.test(l));
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {isList ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {splitLines(content).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <div className="space-y-1.5 text-sm">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Web rendering of the quote document. Mirrors the PDF layout. */
export function QuotePreview({ data, className }: { data: QuoteDocumentData; className?: string }) {
  const money = (m: number) => formatMoney(m, data.quote.currency);
  const taxInclusive = data.totals.pricingMode === "TAX_INCLUSIVE";
  const groups = [
    { label: "Labour", items: data.items.filter((i) => i.kind === "LABOUR") },
    { label: "Materials", items: data.items.filter((i) => i.kind === "MATERIAL") },
    { label: "Other", items: data.items.filter((i) => i.kind === "OTHER") },
  ].filter((g) => g.items.length > 0);
  const showGroups = groups.length > 1;
  return (
    <article className={cn("rounded-xl border bg-white p-5 text-foreground shadow-card sm:p-8", className)} aria-label={`Quote ${data.quote.number}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {data.business.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.business.logoDataUrl} alt={data.business.name} className="mb-2 max-h-14 max-w-[180px] object-contain" />
          ) : null}
          <p className="text-lg font-bold" style={{ color: data.business.brandColor }}>
            {data.business.name}
          </p>
          <div className="text-sm text-muted-foreground">
            {data.business.addressLines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            {data.business.phone ? <p>{data.business.phone}</p> : null}
            {data.business.email ? <p>{data.business.email}</p> : null}
            {data.business.website ? <p>{data.business.website}</p> : null}
            {data.business.taxNumber ? (
              <p className="text-xs">
                {data.totals.taxLabel} no. {data.business.taxNumber}
              </p>
            ) : null}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-extrabold tracking-wide" style={{ color: data.business.brandColor }}>
            QUOTE
          </p>
          <p className="font-semibold">{data.quote.number}</p>
          {data.quote.versionNumber > 1 ? <p className="text-sm text-muted-foreground">Revision {data.quote.versionNumber}</p> : null}
          {data.quote.reference ? <p className="text-sm text-muted-foreground">Ref: {data.quote.reference}</p> : null}
        </div>
      </header>
      <div className="mt-6 grid gap-4 border-y py-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Prepared for</p>
          {data.customer ? (
            <>
              <p className="font-semibold">{data.customer.companyName ?? data.customer.contactName}</p>
              {data.customer.companyName ? <p>{data.customer.contactName}</p> : null}
              {data.customer.billingAddress ? <p className="text-muted-foreground">{data.customer.billingAddress}</p> : null}
              {data.customer.email ? <p className="text-muted-foreground">{data.customer.email}</p> : null}
            </>
          ) : (
            <p className="text-muted-foreground">Customer to be confirmed</p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Job address</p>
          <p>{data.jobAddress || "As above"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dates</p>
          <p>Issued: {formatDate(data.quote.issuedAt ?? data.quote.createdAt)}</p>
          <p>Valid until: {formatDate(data.quote.expiresAt)}</p>
        </div>
      </div>
      <h2 className="mt-6 text-xl font-bold">{data.quote.title}</h2>
      {data.sections.jobSummary ? <p className="mt-1 text-sm">{data.sections.jobSummary}</p> : null}
      <div className="mt-5 space-y-5">
        <Section title="Scope of work" content={data.sections.scopeOfWork} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">Unit price</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.label} label={showGroups ? g.label : null} items={g.items} money={money} />
              ))}
              {data.totals.callOutFeeMinor > 0 ? (
                <tr className="border-b">
                  <td className="px-2 py-2">{data.totals.callOutFeeLabel}</td>
                  <td className="px-2 py-2 text-right">1</td>
                  <td className="px-2 py-2 text-right">{money(data.totals.callOutFeeMinor)}</td>
                  <td className="px-2 py-2 text-right">{money(data.totals.callOutFeeMinor)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <p className="flex justify-between">
            <span>Subtotal{taxInclusive ? ` (incl. ${data.totals.taxLabel})` : ""}</span>
            <span className="tabular">{money(data.totals.subtotalMinor)}</span>
          </p>
          {data.totals.discountMinor > 0 ? (
            <p className="flex justify-between">
              <span>{data.totals.discountLabel ?? "Discount"}</span>
              <span className="tabular">-{money(data.totals.discountMinor)}</span>
            </p>
          ) : null}
          {data.totals.pricingMode !== "NO_TAX" && data.totals.taxRateBps > 0 ? (
            <p className="flex justify-between">
              <span>
                {taxInclusive ? `Of which ${data.totals.taxLabel}` : data.totals.taxLabel} ({(data.totals.taxRateBps / 100).toFixed(data.totals.taxRateBps % 100 === 0 ? 0 : 1)}%)
              </span>
              <span className="tabular">{money(data.totals.taxMinor)}</span>
            </p>
          ) : null}
          <p className="flex justify-between border-t-2 border-foreground pt-1.5 text-base font-bold">
            <span>Total</span>
            <span className="tabular">{money(data.totals.totalMinor)}</span>
          </p>
          {data.totals.pricingMode === "NO_TAX" ? <p className="text-right text-xs text-muted-foreground">No tax applied.</p> : null}
        </div>
        <Section title="What is included" content={data.sections.includedWork} />
        <Section title="Assumptions" content={data.sections.assumptions} />
        <Section title="Exclusions" content={data.sections.exclusions} />
        <Section title="Customer responsibilities" content={data.sections.customerResponsibilities} />
        <Section title="Estimated schedule" content={data.sections.estimatedSchedule} />
        <Section title="Payment terms" content={data.sections.paymentTerms} />
        <Section title="Deposit" content={data.sections.depositTerms} />
        <Section title="Warranty" content={data.sections.warrantyWording} />
        <Section title="Quote validity" content={data.sections.validityWording} />
        <Section title="Notes" content={data.sections.customerNotes} />
        {data.acceptance ? (
          <div className={cn("rounded-lg border p-3 text-sm", data.acceptance.decision === "ACCEPTED" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
            <p className="font-semibold">{data.acceptance.decision === "ACCEPTED" ? "Quote accepted" : "Quote declined"}</p>
            {data.acceptance.signedName ? <p>Signed by: {data.acceptance.signedName}</p> : null}
            <p>Date: {formatDate(data.acceptance.at, "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            {data.acceptance.reason ? <p>Reason: {data.acceptance.reason}</p> : null}
          </div>
        ) : null}
      </div>
      <footer className="mt-6 border-t pt-3 text-xs text-muted-foreground">
        {data.business.footer ?? `${data.business.name} — Quote ${data.quote.number}`}
        {data.showQuoteCueBranding ? " · Created with QuoteCue AI" : ""}
      </footer>
    </article>
  );
}

function GroupRows({ label, items, money }: { label: string | null; items: QuoteDocumentData["items"]; money: (m: number) => string }) {
  return (
    <>
      {label ? (
        <tr className="bg-muted/30">
          <td colSpan={4} className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </td>
        </tr>
      ) : null}
      {items.map((item) => (
        <tr key={item.id} className="border-b align-top">
          <td className="px-2 py-2">
            <p>
              {item.description}
              {item.isOptional ? <span className="ml-1 text-xs text-muted-foreground">(optional)</span> : null}
            </p>
            {item.customerDescription ? <p className="text-xs text-muted-foreground">{item.customerDescription}</p> : null}
            {item.lineDiscountMinor > 0 ? <p className="text-xs text-muted-foreground">Includes discount of {money(item.lineDiscountMinor)}</p> : null}
          </td>
          <td className="whitespace-nowrap px-2 py-2 text-right tabular">
            {item.quantity} {UNIT_SHORT[item.unit as ServiceUnit] ?? ""}
          </td>
          <td className="whitespace-nowrap px-2 py-2 text-right tabular">{money(item.unitPriceMinor)}</td>
          <td className="whitespace-nowrap px-2 py-2 text-right tabular">{item.isOptional ? `(${money(item.lineTotalMinor)})` : money(item.lineTotalMinor)}</td>
        </tr>
      ))}
    </>
  );
}
