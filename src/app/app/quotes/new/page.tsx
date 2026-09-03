import { redirect } from "next/navigation";
import { requireWorkspaceForPage } from "@/lib/auth";
import { createQuote } from "@/lib/services/quotes";

/** Creates a draft quote and opens the wizard. */
export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const params = await searchParams;
  const ctx = await requireWorkspaceForPage("/app/quotes/new");
  if (ctx.supportSession) redirect("/app/quotes");
  const quote = await createQuote({ workspaceId: ctx.workspace.id, userId: ctx.user.id, basics: params.customerId ? { customerId: params.customerId } : undefined });
  redirect(`/app/quotes/${quote.id}/edit?step=${params.customerId ? 2 : 1}`);
}
