import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { getPublicQuoteByToken, recordPublicView } from "@/lib/services/public-quote";
import { getSessionContext } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/utils/request";
import { hashIp, generateSecureToken } from "@/lib/utils/tokens";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { QuotePreview } from "@/components/quotes/quote-preview";
import { DecisionForm } from "@/components/public-quote/decision-form";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Your quote", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = await getClientIp();
  const limit = await checkRateLimit("publicQuote", ip ?? "unknown");
  if (!limit.allowed) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Alert variant="warning" title="Too many requests">
          Please wait a moment and refresh the page.
        </Alert>
      </main>
    );
  }
  const result = await getPublicQuoteByToken(token);
  if (!result) notFound();

  // Do not count the business's own views; dedupe repeat views with a viewer cookie.
  const session = await getSessionContext();
  const cookieStore = await cookies();
  const viewerCookieName = `qv_${result.quoteId.slice(0, 8)}`;
  const existingViewer = cookieStore.get(viewerCookieName)?.value ?? null;
  const isOwnerView = !!session && (await isWorkspaceMember(session.user.id, result.workspaceId));
  let viewerKey = existingViewer;
  if (!isOwnerView) {
    if (!viewerKey) {
      viewerKey = generateSecureToken(12);
      try {
        cookieStore.set(viewerCookieName, viewerKey, { httpOnly: true, sameSite: "lax", path: `/q/${token}`, maxAge: 60 * 60 * 24 * 90 });
      } catch {
        // Cookies cannot always be set during render; the view is still recorded.
      }
    }
    await recordPublicView(result.quoteId, result.workspaceId, { viewerKey, ipHash: hashIp(ip), isNewViewer: !existingViewer });
  }
  const doc = result.document;
  const total = formatMoney(doc.totals.totalMinor, doc.quote.currency);
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quote from</p>
            <p className="text-lg font-bold" style={{ color: doc.business.brandColor }}>
              {doc.business.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={doc.quote.status === "ACCEPTED" ? "success" : doc.quote.status === "DECLINED" ? "destructive" : doc.quote.status === "EXPIRED" ? "outline" : "info"}>
              {doc.quote.status === "ACCEPTED" ? "Accepted" : doc.quote.status === "DECLINED" ? "Declined" : doc.quote.status === "EXPIRED" ? "Expired" : "Awaiting your decision"}
            </Badge>
            <Button asChild variant="secondary" size="sm">
              <a href={`/q/${token}/pdf`} target="_blank" rel="noopener">
                <FileDown /> Download PDF
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {isOwnerView ? <Alert variant="info">You are viewing this quote as a member of {doc.business.name}. Your visit is not counted as a customer view.</Alert> : null}
        {result.linkExpired ? <Alert variant="warning">This link has expired. Please contact {doc.business.name} for a new one.</Alert> : null}
        {result.quoteExpired ? (
          <Alert variant="warning" title="This quote has expired">
            It was valid until {formatDate(doc.quote.expiresAt)}. You can still read it, but to go ahead please contact {doc.business.name}
            {doc.business.phone ? ` on ${doc.business.phone}` : doc.business.email ? ` at ${doc.business.email}` : ""}.
          </Alert>
        ) : null}
        <QuotePreview data={doc} />
        <section className="rounded-xl border bg-white p-5 shadow-card sm:p-6" aria-labelledby="decision-heading">
          <h2 id="decision-heading" className="text-lg font-bold">
            Your decision
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Total {total}. Valid until {formatDate(doc.quote.expiresAt)}.
          </p>
          {doc.acceptance ? (
            <Alert variant={doc.acceptance.decision === "ACCEPTED" ? "success" : "info"} title={doc.acceptance.decision === "ACCEPTED" ? "Quote accepted" : "Quote declined"}>
              Recorded on {formatDate(doc.acceptance.at, "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              {doc.acceptance.signedName ? ` by ${doc.acceptance.signedName}` : ""}.
            </Alert>
          ) : result.canDecide && !isOwnerView ? (
            <DecisionForm token={token} businessName={doc.business.name} total={total} />
          ) : !result.acceptanceEnabled ? (
            <p className="text-sm text-muted-foreground">Online acceptance is not available. Please contact {doc.business.name} directly.</p>
          ) : isOwnerView ? (
            <p className="text-sm text-muted-foreground">Customers see Accept and Decline buttons here.</p>
          ) : (
            <p className="text-sm text-muted-foreground">This quote can no longer be accepted online.</p>
          )}
        </section>
        <p className="text-center text-xs text-muted-foreground">
          {doc.showQuoteCueBranding ? (
            <>
              Powered by{" "}
              <Link href="/" className="underline">
                QuoteCue AI
              </Link>
              {" · "}
            </>
          ) : null}
          Questions? Contact {doc.business.name}
          {doc.business.email ? (
            <>
              {" "}
              at <a href={`mailto:${doc.business.email}`} className="underline">{doc.business.email}</a>
            </>
          ) : null}
          .
        </p>
      </main>
    </div>
  );
}

async function isWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  const { prisma } = await import("@/lib/db");
  const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { id: true } });
  return !!m;
}
