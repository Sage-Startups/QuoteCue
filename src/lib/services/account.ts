import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { AppError } from "@/lib/utils/result";
import { trackEvent } from "./app-events";

/**
 * Personal-data export: everything QuoteCue holds about the user and the
 * workspaces they own, as a JSON document. Internal costs are included because
 * the workspace owner is entitled to their own business data.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, locale: true, onboardingCompletedAt: true, lastLoginAt: true },
  });
  const memberships = await prisma.workspaceMember.findMany({ where: { userId }, include: { workspace: { select: { id: true, name: true, ownerId: true } } } });
  const ownedIds = memberships.filter((m) => m.workspace.ownerId === userId).map((m) => m.workspaceId);
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: ownedIds } },
    include: {
      settings: true,
      customers: { include: { tags: { include: { tag: true } } } },
      catalogueItems: true,
      quoteTemplates: true,
      quotes: { where: { deletedAt: null }, include: { versions: { include: { items: true } }, events: true, acceptances: true } },
      creditLedger: true,
      subscription: { include: { plan: { select: { key: true, name: true } } } },
    },
  });
  const sessions = await prisma.session.findMany({ where: { userId }, select: { createdAt: true, expiresAt: true, userAgent: true } });
  return {
    exportedAt: new Date().toISOString(),
    user,
    memberships: memberships.map((m) => ({ workspaceId: m.workspaceId, workspaceName: m.workspace.name, role: m.role, joinedAt: m.createdAt })),
    ownedWorkspaces: workspaces,
    sessions,
  };
}

/**
 * Deletes the user's account. Workspaces the user solely owns are deleted with
 * all of their data and stored files; memberships in other workspaces are
 * removed. Sessions cascade with the user row.
 */
export async function deleteUserAccount(userId: string, options: { actorUserId?: string; reason?: string } = {}) {
  const owned = await prisma.workspace.findMany({ where: { ownerId: userId }, select: { id: true, _count: { select: { members: true } } } });
  for (const ws of owned) {
    const otherAdmin = await prisma.workspaceMember.findFirst({ where: { workspaceId: ws.id, role: "ADMIN", userId: { not: userId } }, select: { userId: true } });
    if (otherAdmin) {
      // Transfer ownership to another admin instead of deleting shared work.
      await prisma.workspace.update({ where: { id: ws.id }, data: { ownerId: otherAdmin.userId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: ws.id, userId } });
    } else {
      await deleteWorkspaceCompletely(ws.id);
    }
  }
  await prisma.workspaceMember.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await trackEvent({ name: "account_deleted", userId: null, properties: { byAdmin: !!options.actorUserId } });
}

export async function deleteWorkspaceCompletely(workspaceId: string): Promise<void> {
  const objects = await prisma.storedObject.findMany({ where: { workspaceId }, select: { key: true } });
  const storage = getStorage();
  for (const obj of objects) {
    await storage.deleteObject(obj.key).catch(() => undefined);
  }
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function requireNotLastSuperAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole === "SUPER_ADMIN") {
    const count = await prisma.user.count({ where: { platformRole: "SUPER_ADMIN", deletedAt: null } });
    if (count <= 1) throw new AppError("You are the only super admin. Promote another super admin before deleting this account.");
  }
}
