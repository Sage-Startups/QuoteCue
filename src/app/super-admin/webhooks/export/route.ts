import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { csvResponse, superAdminForRoute } from "../../_lib/admin";
import { buildWebhookWhere } from "../query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const where = buildWebhookWhere({ q: sp.get("q") ?? undefined, status: sp.get("status") ?? undefined });
  const events = await prisma.stripeWebhookEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000 });
  const rows = events.map((e) => ({ id: e.id, stripe_event_id: e.stripeEventId, type: e.type, status: e.status, livemode: e.livemode ? "yes" : "no", api_version: e.apiVersion ?? "", error: e.error ?? "", received_at: e.createdAt.toISOString(), processed_at: e.processedAt?.toISOString() ?? "" }));
  return csvResponse(toCsv(rows), "stripe-webhooks");
}
