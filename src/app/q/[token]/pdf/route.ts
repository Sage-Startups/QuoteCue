import { NextResponse } from "next/server";
import { getPublicQuoteByToken } from "@/lib/services/public-quote";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ipFromRequest } from "@/lib/utils/request";

export const dynamic = "force-dynamic";

/** Customer PDF download via the secure quote token. */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const limit = await checkRateLimit("publicQuote", ipFromRequest(request) ?? "unknown");
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const result = await getPublicQuoteByToken(token);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buffer = await renderQuotePdf(result.document);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${result.document.quote.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
