import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/services/audit";
import { getClientIp } from "@/lib/utils/request";
import { isUuid, jsonDownload, superAdminForRoute } from "../../../_lib/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Full JSON export of one workspace (for data requests and migrations). Audited. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const workspace = await prisma.workspace.findFirst({
    where: { id, deletedAt: null },
    include: {
      settings: true,
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      customers: { include: { tags: { include: { tag: true } } } },
      catalogueItems: true,
      quoteTemplates: true,
      quotes: { include: { versions: { include: { items: true } }, events: true, acceptances: true, media: true } },
      subscription: { include: { plan: { select: { key: true, name: true } } } },
      invoices: true,
      creditLedger: true,
      usageRecords: true,
    },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await recordAudit({ actorUserId: guard.session.user.id, actorEmail: guard.session.user.email, action: "workspace.export", targetType: "workspace", targetId: workspace.id, newValue: { quotes: workspace.quotes.length, customers: workspace.customers.length }, ip: await getClientIp() });
  const { invoices, creditLedger, usageRecords, ...rest } = workspace;
  return jsonDownload({ exportedAt: new Date().toISOString(), workspace: rest, billing: { invoices, ledger: creditLedger, usage: usageRecords } }, `workspace-${workspace.slug}`);
}
