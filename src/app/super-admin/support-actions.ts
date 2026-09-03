"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, WORKSPACE_COOKIE } from "@/lib/auth";
import { recordAudit } from "@/lib/services/audit";
import { getClientIp } from "@/lib/utils/request";
import { addMonths } from "@/lib/utils/dates";

/** Opens a read-only support session on a workspace. Requires a reason; recorded in the audit log. */
export async function startSupportSessionAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!workspaceId || reason.length < 5) redirect(`/super-admin/workspaces/${workspaceId}?error=reason`);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } });
  if (!workspace) redirect("/super-admin/workspaces?error=notfound");
  await prisma.supportSession.updateMany({ where: { adminUserId: admin.user.id, endedAt: null }, data: { endedAt: new Date() } });
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const session = await prisma.supportSession.create({ data: { adminUserId: admin.user.id, workspaceId, reason, expiresAt } });
  await recordAudit({ actorUserId: admin.user.id, actorEmail: admin.user.email, action: "support.session.start", targetType: "workspace", targetId: workspaceId, reason, newValue: { supportSessionId: session.id, expiresAt: expiresAt.toISOString() }, ip: await getClientIp() });
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", expires: addMonths(new Date(), 1) });
  redirect("/app");
}

export async function endSupportSessionAction(): Promise<void> {
  const admin = await requireSuperAdmin();
  const sessions = await prisma.supportSession.findMany({ where: { adminUserId: admin.user.id, endedAt: null } });
  await prisma.supportSession.updateMany({ where: { adminUserId: admin.user.id, endedAt: null }, data: { endedAt: new Date() } });
  for (const s of sessions) {
    await recordAudit({ actorUserId: admin.user.id, actorEmail: admin.user.email, action: "support.session.end", targetType: "workspace", targetId: s.workspaceId, newValue: { supportSessionId: s.id }, ip: await getClientIp() });
  }
  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_COOKIE);
  redirect("/super-admin/workspaces");
}
