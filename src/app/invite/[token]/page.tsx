import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionContext, WORKSPACE_COOKIE } from "@/lib/auth";
import { getInviteByToken, acceptInvite } from "@/lib/services/team";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { addMonths } from "@/lib/utils/dates";
import { toUserMessage } from "@/lib/utils/result";

export const metadata: Metadata = { title: "Team invitation", robots: { index: false } };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getInviteByToken(token);
  const session = await getSessionContext();

  async function accept() {
    "use server";
    const s = await getSessionContext();
    if (!s) redirect(`/login?next=/invite/${token}`);
    try {
      const workspaceId = await acceptInvite(token, s.user.id, s.user.email);
      const cookieStore = await cookies();
      cookieStore.set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", expires: addMonths(new Date(), 12) });
    } catch (e) {
      redirect(`/invite/${token}?error=${encodeURIComponent(toUserMessage(e))}`);
    }
    redirect("/app?welcome=1");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <AuthCard title="Team invitation" description={invite ? `${invite.invitedBy.name} has invited you to join ${invite.workspace.name} as a ${invite.role === "ADMIN" ? "workspace admin" : "team member"}.` : "This invitation is invalid or has expired."}>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          {!invite ? (
            <Button asChild className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
          ) : session ? (
            <form action={accept} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Signed in as <strong>{session.user.email}</strong>. The invitation was sent to <strong>{invite.email}</strong>.
              </p>
              <Button type="submit" className="w-full" size="lg">
                Accept invitation
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Sign in or create an account with {invite.email} to accept.</p>
              <Button asChild className="w-full" size="lg">
                <Link href={`/login?next=/invite/${token}`}>Sign in</Link>
              </Button>
              <Button asChild variant="secondary" className="w-full">
                <Link href={`/signup?next=/invite/${token}`}>Create an account</Link>
              </Button>
            </div>
          )}
        </AuthCard>
      </div>
    </div>
  );
}
