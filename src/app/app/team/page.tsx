import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserMinus, XCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { requireWorkspaceForPage } from "@/lib/auth";
import { listTeam } from "@/lib/services/team";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { PageHeader, Alert, Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmButton } from "@/components/app/confirm-button";
import { formatRelative, formatDate } from "@/lib/utils/dates";
import { InviteForm } from "./invite-form";
import { revokeInviteAction, removeMemberAction, changeRoleAction } from "./actions";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireWorkspaceForPage("/app/team");
  if (!ctx.isAdmin && !ctx.supportSession) redirect("/app");
  const [{ members, invites }, entitlements, enabled] = await Promise.all([listTeam(ctx.workspace.id), getWorkspaceEntitlements(ctx.workspace.id), isFeatureEnabled("team_accounts")]);
  const remaining = entitlements.maxMembers - members.length - invites.length;
  const readOnly = !!ctx.supportSession;
  return (
    <div className="space-y-6">
      <PageHeader title="Team" description={`${members.length} of ${entitlements.maxMembers} seats used on the ${entitlements.planName} plan.`} />
      {!enabled ? <Alert variant="warning">Team accounts are currently disabled by the administrator.</Alert> : null}
      {entitlements.maxMembers <= 1 ? (
        <Alert variant="info" title="Invite your team with Pro">
          The Pro plan includes up to five users sharing customers, catalogues and quotes.{" "}
          <Link href="/app/billing" className="font-semibold underline">
            See plans
          </Link>
        </Alert>
      ) : null}
      {!readOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a team member</CardTitle>
            <CardDescription>They will receive an email with a link that expires in seven days.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm disabled={!enabled || remaining <= 0} remaining={remaining} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => {
              const isOwner = m.userId === ctx.workspace.ownerId;
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={m.user.name} src={m.user.image} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {m.user.name} {m.userId === ctx.user.id ? <span className="text-xs font-normal text-muted-foreground">(you)</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.user.email} · last active {m.user.lastLoginAt ? formatRelative(m.user.lastLoginAt) : "never"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isOwner ? "accent" : m.role === "ADMIN" ? "info" : "secondary"}>{isOwner ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}</Badge>
                    {!readOnly && !isOwner && m.userId !== ctx.user.id ? (
                      <>
                        <ConfirmButton action={changeRoleAction} hidden={{ userId: m.userId, role: m.role === "ADMIN" ? "MEMBER" : "ADMIN" }} variant="ghost" size="sm">
                          {m.role === "ADMIN" ? <ShieldOff /> : <ShieldCheck />} {m.role === "ADMIN" ? "Make member" : "Make admin"}
                        </ConfirmButton>
                        <ConfirmButton action={removeMemberAction} hidden={{ userId: m.userId }} variant="ghost" size="sm" confirmTitle={`Remove ${m.user.name}?`} confirmDescription="They will lose access immediately. Their quotes remain in the workspace." confirmLabel="Remove">
                          <UserMinus /> Remove
                        </ConfirmButton>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      {invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{i.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.role === "ADMIN" ? "Admin" : "Member"} · invited by {i.invitedBy.name} · expires {formatDate(i.expiresAt)}
                    </p>
                  </div>
                  {!readOnly ? (
                    <ConfirmButton action={revokeInviteAction} hidden={{ id: i.id }} variant="ghost" size="sm">
                      <XCircle /> Revoke
                    </ConfirmButton>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
