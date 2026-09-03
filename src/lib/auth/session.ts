import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PlatformRole, WorkspaceRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/utils/result";
import { auth } from "./auth";

export const WORKSPACE_COOKIE = "quotecue.workspace";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  platformRole: PlatformRole;
  suspendedAt: Date | null;
  onboardingCompletedAt: Date | null;
  locale: string;
  createdAt: Date;
}

export interface SessionContext {
  user: SessionUser;
  sessionId: string;
  sessionToken: string;
}

export interface WorkspaceContext extends SessionContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
    isDemo: boolean;
    aiCreditBalance: number;
  };
  role: WorkspaceRole;
  isOwner: boolean;
  isAdmin: boolean;
  /** Present when a super admin is viewing the workspace in read-only support mode. */
  supportSession: { id: string; reason: string; expiresAt: Date } | null;
}

/**
 * Loads the current session from Better Auth and the up-to-date user record.
 * Cached per request so pages and actions can call it freely.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result?.session || !result.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: result.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      image: true,
      platformRole: true,
      suspendedAt: true,
      onboardingCompletedAt: true,
      locale: true,
      createdAt: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt || user.suspendedAt) return null;
  const { deletedAt: _deleted, ...safeUser } = user;
  return { user: safeUser, sessionId: result.session.id, sessionToken: result.session.token };
});

export async function requireSession(options: { redirectTo?: string } = {}): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    if (options.redirectTo !== undefined) {
      redirect(`/login?next=${encodeURIComponent(options.redirectTo)}`);
    }
    throw new UnauthorizedError();
  }
  return ctx;
}

/** Page helper: redirects to login (or onboarding) instead of throwing. */
export async function requireSessionForPage(currentPath: string): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  return ctx;
}

async function loadMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, ownerId: true, status: true, isDemo: true, aiCreditBalance: true, deletedAt: true },
      },
    },
  });
}

/**
 * Resolves the active workspace for the signed-in user. The workspace id comes
 * from a cookie but membership is always re-validated against the database;
 * a workspaceId supplied by the browser is never trusted on its own.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const session = await getSessionContext();
  if (!session) return null;
  const cookieStore = await cookies();
  const preferred = cookieStore.get(WORKSPACE_COOKIE)?.value;

  // Support-mode access for super admins.
  if (preferred && session.user.platformRole === "SUPER_ADMIN") {
    const supportSession = await prisma.supportSession.findFirst({
      where: { adminUserId: session.user.id, workspaceId: preferred, endedAt: null, expiresAt: { gt: new Date() } },
      include: { workspace: { select: { id: true, name: true, slug: true, ownerId: true, status: true, isDemo: true, aiCreditBalance: true } } },
    });
    if (supportSession) {
      return {
        ...session,
        workspace: supportSession.workspace,
        role: "MEMBER",
        isOwner: false,
        isAdmin: false,
        supportSession: { id: supportSession.id, reason: supportSession.reason, expiresAt: supportSession.expiresAt },
      };
    }
  }

  let membership = preferred ? await loadMembership(session.user.id, preferred) : null;
  if (!membership || membership.workspace.deletedAt) {
    const first = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id, workspace: { deletedAt: null } },
      orderBy: { createdAt: "asc" },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true, ownerId: true, status: true, isDemo: true, aiCreditBalance: true, deletedAt: true },
        },
      },
    });
    membership = first;
  }
  if (!membership) return null;
  const { deletedAt: _d, ...workspace } = membership.workspace;
  return {
    ...session,
    workspace,
    role: membership.role,
    isOwner: workspace.ownerId === session.user.id,
    isAdmin: membership.role === "ADMIN" || workspace.ownerId === session.user.id,
    supportSession: null,
  };
});

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    const session = await getSessionContext();
    if (!session) throw new UnauthorizedError();
    throw new ForbiddenError("Finish onboarding to create your workspace first.");
  }
  if (ctx.workspace.status === "SUSPENDED" && !ctx.supportSession) {
    throw new ForbiddenError("This workspace has been suspended. Please contact support.");
  }
  return ctx;
}

/** Page helper: redirects to onboarding when the user has no workspace yet. */
export async function requireWorkspaceForPage(currentPath: string): Promise<WorkspaceContext> {
  const session = await getSessionContext();
  if (!session) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/onboarding");
  if (ctx.workspace.status === "SUSPENDED" && !ctx.supportSession) redirect("/app/suspended");
  return ctx;
}

export async function requireWorkspaceRole(role: WorkspaceRole): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (ctx.supportSession) throw new ForbiddenError("Support mode is read-only.");
  if (role === "ADMIN" && !ctx.isAdmin) throw new ForbiddenError("Only workspace admins can do that.");
  return ctx;
}

export async function requireWorkspaceAdmin(): Promise<WorkspaceContext> {
  return requireWorkspaceRole("ADMIN");
}

/** Throws when the workspace is in read-only support mode (write actions). */
export async function requireWritableWorkspace(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (ctx.supportSession) throw new ForbiddenError("Support mode is read-only. End the support session to make changes.");
  return ctx;
}

export async function requireSupportAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.user.platformRole !== "SUPPORT_ADMIN" && ctx.user.platformRole !== "SUPER_ADMIN") {
    throw new ForbiddenError("Support admin access required.");
  }
  return ctx;
}

export async function requireSuperAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.user.platformRole !== "SUPER_ADMIN") throw new ForbiddenError("Super admin access required.");
  return ctx;
}

export async function requireSuperAdminForPage(currentPath: string): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  if (ctx.user.platformRole !== "SUPER_ADMIN") redirect("/app?error=forbidden");
  return ctx;
}

export function isPlatformAdmin(role: PlatformRole): boolean {
  return role === "SUPER_ADMIN" || role === "SUPPORT_ADMIN";
}
