import type { Metadata } from "next";
import { headers } from "next/headers";
import { Download, LogOut, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { requireSessionForPage, getWorkspaceContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmButton } from "@/components/app/confirm-button";
import { formatDateTime } from "@/lib/utils/dates";
import { ProfileForm, PasswordForm } from "./forms";
import { revokeSessionAction, revokeOtherSessionsAction, deleteAccountAction } from "./actions";

export const metadata: Metadata = { title: "Personal account" };

export default async function AccountPage() {
  const session = await requireSessionForPage("/app/account");
  const ws = await getWorkspaceContext();
  const [sessions, memberships] = await Promise.all([
    auth.api.listSessions({ headers: await headers() }).catch(() => []),
    prisma.workspaceMember.findMany({ where: { userId: session.user.id }, include: { workspace: { select: { id: true, name: true, ownerId: true } } } }),
  ]);
  const ownedAlone = memberships.filter((m) => m.workspace.ownerId === session.user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Personal account" description={session.user.email} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm name={session.user.name} email={session.user.email} locale={session.user.locale} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Changing your password signs out every other device.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices currently signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.userAgent ? s.userAgent.slice(0, 80) : "Unknown device"} {s.token === session.sessionToken ? <Badge variant="success">This device</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed in {formatDateTime(s.createdAt)} · expires {formatDateTime(s.expiresAt)}
                  </p>
                </div>
                {s.token !== session.sessionToken ? (
                  <ConfirmButton action={revokeSessionAction} hidden={{ token: s.token }} variant="ghost" size="sm">
                    <LogOut /> Revoke
                  </ConfirmButton>
                ) : null}
              </li>
            ))}
          </ul>
          {sessions.length > 1 ? (
            <ConfirmButton action={async () => revokeOtherSessionsAction()} variant="secondary" size="sm">
              Sign out all other devices
            </ConfirmButton>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {memberships.map((m) => (
              <li key={m.id} className="flex justify-between py-2">
                <span>
                  {m.workspace.name} {ws?.workspace.id === m.workspace.id ? <Badge variant="secondary">Current</Badge> : null}
                </span>
                <span className="text-muted-foreground">{m.workspace.ownerId === session.user.id ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>Export everything we hold about you, or delete your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild variant="secondary">
            <a href="/app/account/export">
              <Download /> Download my data (JSON)
            </a>
          </Button>
          <Alert variant="warning" title="Delete account">
            {ownedAlone.length > 0 ? `You are the sole owner of ${ownedAlone.map((m) => m.workspace.name).join(", ")}. Deleting your account permanently deletes ${ownedAlone.length === 1 ? "that workspace" : "those workspaces"} including customers, quotes and files, unless another admin exists to take ownership.` : "Your memberships will be removed and your account permanently deleted."}
          </Alert>
          <ConfirmButton action={deleteAccountAction} variant="destructive" confirmTitle="Delete your account?" confirmDescription="This cannot be undone." confirmLabel="Delete my account" typeToConfirm="DELETE" hidden={{ confirm: "DELETE" }}>
            <Trash2 /> Delete my account
          </ConfirmButton>
        </CardContent>
      </Card>
    </div>
  );
}
