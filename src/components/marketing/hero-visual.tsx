import { Camera, Check, Mic, Sparkles } from "lucide-react";

/**
 * A static, HTML/CSS illustration of the product: a rough customer enquiry on
 * the left and the resulting quote document on the right. Every figure shown
 * is an example and is labelled as such.
 */
export function HeroVisual() {
  return (
    <figure className="relative mx-auto w-full max-w-3xl">
      <figcaption className="sr-only">Example: a rough customer message on the left becomes a structured, priced quote on the right.</figcaption>
      <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-stretch">
        {/* Before: rough enquiry */}
        <div className="flex flex-col rounded-2xl border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Enquiry</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Example</span>
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-3">
            <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-navy-50 px-3.5 py-2.5 text-sm leading-snug text-navy-900">
              hi mate, need 2 double sockets putting in the front room either side of the fireplace and the hall light changing to an LED panel. fuse box is in the garage. before end of month?
            </div>
            <div className="ml-auto flex max-w-[80%] items-center gap-2 rounded-2xl rounded-tr-sm bg-navy-800 px-3.5 py-2.5 text-sm text-white">
              <Mic className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
              <span className="flex items-end gap-0.5" aria-hidden="true">
                {[6, 12, 8, 14, 9, 5, 11, 7, 13, 6, 9, 4].map((h, i) => (
                  <span key={i} className="w-1 rounded-full bg-white/70" style={{ height: `${h}px` }} />
                ))}
              </span>
              <span className="text-xs text-navy-100">0:42</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
              <Camera className="size-4 shrink-0" aria-hidden="true" />
              <span>2 photos · consumer unit, hallway</span>
            </div>
          </div>
        </div>

        {/* After: mini quote document */}
        <div className="relative rounded-2xl border bg-white p-4 shadow-elevated sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quote</p>
              <p className="mt-1 text-sm font-semibold leading-tight text-foreground">Electrical works — living room sockets and hallway lighting</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Example</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <div>
              <dt className="sr-only">Quote number</dt>
              <dd>Q-2026-0142</dd>
            </div>
            <div className="text-right">
              <dt className="sr-only">Validity</dt>
              <dd>Valid for 30 days</dd>
            </div>
          </dl>
          <table className="mt-3 w-full text-xs">
            <caption className="sr-only">Example line items</caption>
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-1.5 font-medium">
                  Item
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              <tr className="border-b border-border/60">
                <td className="py-2 pr-2 text-foreground">Install double socket outlet</td>
                <td className="py-2 text-right">2</td>
                <td className="py-2 text-right">£190.00</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-2 text-foreground">Replace light fitting (customer supplied)</td>
                <td className="py-2 text-right">1</td>
                <td className="py-2 text-right">£55.00</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-2 text-foreground">Minor works certificate</td>
                <td className="py-2 text-right">1</td>
                <td className="py-2 text-right">£45.00</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-2 text-foreground">Cable and consumables</td>
                <td className="py-2 text-right">1</td>
                <td className="py-2 text-right">£25.00</td>
              </tr>
            </tbody>
            <tfoot className="tabular">
              <tr>
                <td colSpan={2} className="pt-2 text-right text-muted-foreground">
                  Subtotal
                </td>
                <td className="pt-2 text-right">£315.00</td>
              </tr>
              <tr>
                <td colSpan={2} className="py-0.5 text-right text-muted-foreground">
                  VAT 20%
                </td>
                <td className="py-0.5 text-right">£63.00</td>
              </tr>
              <tr className="text-sm font-semibold text-foreground">
                <td colSpan={2} className="pt-1.5 text-right">
                  Total
                </td>
                <td className="pt-1.5 text-right">£378.00</td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-navy-50 px-3 py-2 text-[11px] leading-snug text-navy-800">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
            <p>Assumes spare capacity on the consumer unit; confirmed on site.</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Accept online · PDF · Secure link</p>
            <span className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-[11px] font-semibold text-white">
              <Check className="size-3" aria-hidden="true" />
              Accept quote
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
