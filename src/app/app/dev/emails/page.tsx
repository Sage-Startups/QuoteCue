import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspaceForPage } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Email previews" };

/** Development-only inbox showing emails that would have been sent. */
export default async function DevEmailsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const env = getEnv();
  if (env.isProduction || env.providers.email !== "preview") notFound();
  const ctx = await requireWorkspaceForPage("/app/dev/emails");
  const params = await searchParams;
  const emails = await prisma.emailEvent.findMany({
    where: { OR: [{ workspaceId: ctx.workspace.id }, { userId: ctx.user.id }, { toEmail: ctx.user.email }], status: "PREVIEW" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, kind: true, toEmail: true, subject: true, createdAt: true },
  });
  const selected = params.id ? await prisma.emailEvent.findFirst({ where: { id: params.id, OR: [{ workspaceId: ctx.workspace.id }, { userId: ctx.user.id }, { toEmail: ctx.user.email }] } }) : null;
  return (
    <div className="space-y-6">
      <PageHeader title="Email previews" description="Development email preview mode: RESEND_API_KEY is not set, so nothing is delivered. Emails are stored here instead." />
      <Alert variant="warning">Email preview mode is active. Verification, reset and quote emails appear below instead of being sent.</Alert>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card lg:col-span-1">
          {emails.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No emails yet.</p>
          ) : (
            <ul className="divide-y">
              {emails.map((e) => (
                <li key={e.id}>
                  <a href={`/app/dev/emails?id=${e.id}`} className={`block p-3 hover:bg-muted ${selected?.id === e.id ? "bg-muted" : ""}`}>
                    <p className="truncate text-sm font-semibold">{e.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      to {e.toEmail} · {formatDateTime(e.createdAt)}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {e.kind}
                    </Badge>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border bg-card lg:col-span-2">
          {selected?.htmlPreview ? (
            <iframe title={selected.subject} srcDoc={selected.htmlPreview} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[70vh] w-full rounded-xl bg-white" />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Select an email to preview it. Links inside open in a new tab.</p>
          )}
        </div>
      </div>
    </div>
  );
}
