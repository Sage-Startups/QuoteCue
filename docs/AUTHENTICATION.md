# Authentication and authorisation

Authentication is provided by **Better Auth 1.7** with the Prisma adapter. Authorisation (workspace membership, roles, support mode, platform roles) is implemented in `src/lib/auth/session.ts` and enforced server-side on every page, action and route handler.

## Better Auth configuration (`src/lib/auth/auth.ts`)

| Setting | Value |
| --- | --- |
| `baseURL` | `BETTER_AUTH_URL` if set, otherwise `APP_URL` |
| `secret` | `BETTER_AUTH_SECRET` (minimum 32 characters, validated in `env.ts`) |
| `trustedOrigins` | `[APP_URL]` — origin/CSRF checks reject other origins |
| Database | `prismaAdapter(prisma, { provider: "postgresql" })`, ids generated with `randomUUID()` |
| Cookies | prefix `quotecue`, `useSecureCookies` in production, `nextCookies()` plugin for Server Actions |
| Client IP | read from `x-forwarded-for` / `x-real-ip` (Railway's proxy sets these) |
| Sessions | database-backed; expire after 7 days, refreshed once per day of activity, "fresh" for 15 minutes |
| Built-in rate limit | 60 requests per 60-second window on auth endpoints |
| Email + password | enabled; email verification required; password 10–128 characters; no auto sign-in after sign-up; reset token valid 1 hour; **all sessions revoked on password reset** |
| Email verification | sent on sign-up, valid 1 hour, auto sign-in after verification, then a welcome email |
| Magic link | plugin enabled, links valid 10 minutes, `disableSignUp: true` (existing accounts only) |
| User deletion | Better Auth's own delete flow is disabled; deletion goes through `services/account.ts` |

### Database hooks

Before a session is created the hook checks the user row: suspended or deleted users cannot sign in (the hook returns `false`), and `lastLoginAt` is updated.

### Routes

- `/api/auth/[...all]` — Better Auth handler (`toNextJsHandler`).
- `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/magic-link` — pages under `src/app/(auth)`, backed by Server Actions in `src/app/(auth)/actions.ts`.

### Server actions and enumeration safety

`src/app/(auth)/actions.ts` wraps the Better Auth API and adds:

- Zod validation with field errors.
- Database-backed rate limits (`registration` 5/10 min per IP, `login` 10/10 min per IP+email, `passwordReset` 5/15 min, `magicLink` 5/15 min).
- Generic responses that do not reveal whether an address is registered:
  - Sign-up with an existing address returns the same success message and sends an "account already exists" email to the address instead.
  - Password reset, magic link and "resend verification" always return the same message.
- Login errors are reduced to "Incorrect email or password" (or a verification prompt).
- `next` redirect targets pass through `safeRedirectPath`, which allows only same-origin relative paths.
- Registration can be closed with the `app.registrationEnabled` site setting; magic links with the `magic_link_login` feature flag.

## Session and workspace context (`src/lib/auth/session.ts`)

```
getSessionContext()      -> { user, sessionId, sessionToken } | null   (cached per request)
getWorkspaceContext()    -> SessionContext + { workspace, role, isOwner, isAdmin, supportSession }
```

- `getSessionContext` calls `auth.api.getSession` with the request headers and then reloads the user from the database. Deleted or suspended users yield `null` even with a valid cookie.
- `getWorkspaceContext` reads the preferred workspace id from the `quotecue.workspace` cookie and **re-validates it against `WorkspaceMember`**. A cookie value is never trusted on its own; if it does not match a membership the user's first workspace is used. Super admins with an active `SupportSession` for that workspace get a read-only context instead.

### Guards

| Guard | Behaviour |
| --- | --- |
| `requireSession()` | Throws `UnauthorizedError` (401) when signed out; optional redirect |
| `requireSessionForPage(path)` | Page variant: redirects to `/login?next=path` |
| `requireWorkspace()` | Session + membership; throws 401/403; rejects `SUSPENDED` workspaces unless in support mode |
| `requireWorkspaceForPage(path)` | Page variant: redirects to `/login`, `/onboarding` or `/app/suspended` |
| `requireWorkspaceRole("ADMIN")` / `requireWorkspaceAdmin()` | Admin-only actions; **always rejects support sessions** |
| `requireWritableWorkspace()` | Any member, but rejects support sessions (used for writes) |
| `requireSupportAdmin()` | Platform role `SUPPORT_ADMIN` or `SUPER_ADMIN` |
| `requireSuperAdmin()` / `requireSuperAdminForPage(path)` | Platform role `SUPER_ADMIN` (page variant redirects to `/app?error=forbidden`) |

Route handlers use the non-throwing `getSessionContext`/`getWorkspaceContext` and return JSON 401/403 responses.

### Platform roles

| Role | Capabilities |
| --- | --- |
| `USER` | Normal account |
| `SUPPORT_ADMIN` | Passes `requireSupportAdmin`; intended for a limited support console |
| `SUPER_ADMIN` | Full `/super-admin` console, `/api/health/system`, support sessions, site asset uploads |

Roles are changed only by `pnpm admin:promote --email ... [--role ...]`, the seed (`SUPER_ADMIN_EMAIL`) or a super admin in the console; each change is written to `AdminAuditLog`.

### Workspace roles

- `ADMIN` (or owner): settings, billing, team, catalogue management, deleting quotes.
- `MEMBER`: quoting, customers, analytics.
- Onboarding creates the owner as `ADMIN`; invitations carry a role; `services/team.ts` enforces plan member limits.

## Edge proxy

`src/proxy.ts` redirects requests to `/app`, `/super-admin` and `/onboarding` to `/login?next=...` when no cookie containing `session_token` is present. This only avoids rendering a page that would redirect anyway; every page still validates the session on the server.

## Account self-service (`/app/account`)

Profile update, password change, listing and revoking other sessions (`revokeSessionAction`, `revokeOtherSessionsAction`), data export (`/app/account/export`) and account deletion. Deletion transfers solely-owned workspaces to another admin where one exists, otherwise deletes them completely (including bucket objects), and refuses to remove the last super admin.

## Team invitations

`inviteMember` generates a 32-byte token, stores only its SHA-256 hash in `WorkspaceInvite`, revokes older pending invitations to the same address and emails `/invite/<token>`. The invitation is valid for 7 days and can only be accepted by a signed-in user whose email matches.

## Client side

`src/lib/auth/client.ts` exposes `authClient` (`createAuthClient` with the magic-link client plugin) plus `useSession` and `signOut` for the few client components that need them. All privileged decisions remain server-side.
