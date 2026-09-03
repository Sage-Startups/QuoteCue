import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { csvResponse, superAdminForRoute } from "../../_lib/admin";
import { buildEmailWhere } from "../query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const where = buildEmailWhere({ q: sp.get("q") ?? undefined, kind: sp.get("kind") ?? undefined, status: sp.get("status") ?? undefined });
  const events = await prisma.emailEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000, select: { id: true, kind: true, toEmail: true, subject: true, status: true, provider: true, providerMessageId: true, error: true, workspaceId: true, userId: true, quoteId: true, createdAt: true } });
  const rows = events.map((e) => ({ id: e.id, created_at: e.createdAt.toISOString(), kind: e.kind, to: e.toEmail, subject: e.subject, status: e.status, provider: e.provider, provider_message_id: e.providerMessageId ?? "", error: e.error ?? "", workspace_id: e.workspaceId ?? "", user_id: e.userId ?? "", quote_id: e.quoteId ?? "" }));
  return csvResponse(toCsv(rows), "email-events");
}
