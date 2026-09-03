import { z } from "zod";
import type { WorkspaceRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { addDays } from "@/lib/utils/dates";
import { generateSecureToken, hashToken } from "@/lib/utils/tokens";
import { normaliseEmail } from "@/lib/utils/strings";
import { AppError, EntitlementError, NotFoundError } from "@/lib/utils/result";

export const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["MEMBER", "ADMIN"]).default("MEMBER"),
});

export async function listTeam(workspaceId: string) {
  const [members, invites] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { id: true, name: true, email: true, image: true, lastLoginAt: true, emailVerified: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.workspaceInvite.findMany({ where: { workspaceId, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, include: { invitedBy: { select: { name: true } } } }),
  ]);
  return { members, invites };
}

export async function inviteMember(input: { workspaceId: string; workspaceName: string; inviterId: string; inviterName: string; email: string; role: WorkspaceRole }) {
  if (!(await isFeatureEnabled("team_accounts"))) throw new AppError("Team accounts are currently disabled.");
  const email = normaliseEmail(input.email);
  const ent = await getWorkspaceEntitlements(input.workspaceId);
  const pendingCount = await prisma.workspaceInvite.count({ where: { workspaceId: input.workspaceId, status: "PENDING", expiresAt: { gt: new Date() } } });
  if (ent.memberCount + pendingCount >= ent.maxMembers) {
    throw new EntitlementError(`Your plan allows ${ent.maxMembers} team member${ent.maxMembers === 1 ? "" : "s"}. Upgrade to Pro to invite your team.`);
  }
  const existingMember = await prisma.workspaceMember.findFirst({ where: { workspaceId: input.workspaceId, user: { email } } });
  if (existingMember) throw new AppError("That person is already a member of this workspace.");
  const token = generateSecureToken(32);
  await prisma.workspaceInvite.updateMany({ where: { workspaceId: input.workspaceId, email, status: "PENDING" }, data: { status: "REVOKED" } });
  await prisma.workspaceInvite.create({
    data: { workspaceId: input.workspaceId, email, role: input.role, tokenHash: hashToken(token), invitedById: input.inviterId, expiresAt: addDays(new Date(), 7) },
  });
  const inviteUrl = `${getEnv().APP_URL}/invite/${token}`;
  return sendEmail({
    kind: "TEAM_INVITE",
    to: email,
    workspaceId: input.workspaceId,
    variables: { inviterName: input.inviterName, workspaceName: input.workspaceName, inviteUrl, role: input.role === "ADMIN" ? "workspace admin" : "team member" },
  });
}

export async function revokeInvite(workspaceId: string, inviteId: string) {
  const result = await prisma.workspaceInvite.updateMany({ where: { id: inviteId, workspaceId, status: "PENDING" }, data: { status: "REVOKED" } });
  if (result.count === 0) throw new NotFoundError("Invitation not found");
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.workspaceInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { workspace: { select: { id: true, name: true } }, invitedBy: { select: { name: true } } } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) return null;
  return invite;
}

export async function acceptInvite(token: string, userId: string, userEmail: string) {
  const invite = await getInviteByToken(token);
  if (!invite) throw new AppError("This invitation is invalid or has expired.");
  if (normaliseEmail(userEmail) !== invite.email) throw new AppError(`This invitation was sent to ${invite.email}. Sign in with that email address to accept it.`);
  const ent = await getWorkspaceEntitlements(invite.workspaceId);
  if (ent.memberCount >= ent.maxMembers) throw new EntitlementError("This workspace has reached its team member limit.");
  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      create: { workspaceId: invite.workspaceId, userId, role: invite.role },
      update: { role: invite.role },
    }),
    prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } }),
  ]);
  return invite.workspaceId;
}

export async function removeMember(workspaceId: string, memberUserId: string, actingUserId: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { ownerId: true } });
  if (memberUserId === ws.ownerId) throw new AppError("The workspace owner cannot be removed.");
  if (memberUserId === actingUserId) throw new AppError("You cannot remove yourself. Ask another admin, or delete your account.");
  const result = await prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: memberUserId } });
  if (result.count === 0) throw new NotFoundError("Member not found");
}

export async function changeMemberRole(workspaceId: string, memberUserId: string, role: WorkspaceRole) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { ownerId: true } });
  if (memberUserId === ws.ownerId && role !== "ADMIN") throw new AppError("The workspace owner must remain an admin.");
  const result = await prisma.workspaceMember.updateMany({ where: { workspaceId, userId: memberUserId }, data: { role } });
  if (result.count === 0) throw new NotFoundError("Member not found");
}
