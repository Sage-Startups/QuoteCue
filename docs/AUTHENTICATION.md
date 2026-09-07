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
| Email + password | enabled; `requireEmailVerification: false`; password 10–128 characters; `autoSignIn: true`, so sign-up signs the person in; reset token valid 1 hour; **all sessions revoked on password reset** |
| Email verification | not used: `sendOnSignUp: false`, and every new account is created with `emailVerified: true` (see the database hooks below). The reset and magic-link emails are unaffected |
| Magic link | plugin enabled, links valid 10 minutes, `disableSignUp: true` (existing accounts only) |
| User deletion | Better Auth's own delete flow is disabled; deletion goes through `services/account.ts` |

### Database hooks

`user.create.before` sets `emailVerified: true` on every new account, so nothing in the product waits for a verification link. An account whose address was mistyped is reached by the same route as any other support case: the owner changes it, or the account is deleted.

`session.create.before` checks the user row before a session is created: suspended or deleted users cannot sign in (the hook returns `false`), and `lastLoginAt` is updated.

### Routes

- `/api/auth/[...all]` — Better Auth handler (`toNextJsHandler`).
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/magic-link` — pages under `src/app/(auth)`, backed by Server Actions in `src/app/(auth)/actions.ts`. There is no `/verify-email` page.

### Sign-up

`/signup` (`src/app/(auth)/signup/page.tsx`) redirects a visitor who already has a session to `/app`. For everyone else it renders the form, which asks for a plan alongside the name, email, password and terms checkbox:

- the page calls `getPublicPlans()` and keeps the entries with `kind === "SUBSCRIPTION"`;
- `/signup?plan=pro&interval=annual` preselects a plan and a billing interval. The pricing page already emits those links through `planSignupHref`. An unrecognised plan falls back to `FREE`, and any interval other than `annual` to `monthly`;
- `SignUpForm` (`src/components/auth/forms.tsx`) renders one radio card per plan with its monthly or annual price, plus a monthly/annual toggle (shown only when a paid plan exists), and submits `plan` and `interval` with the rest of the fields.

`signUpAction` in `src/app/(auth)/actions.ts` then:

1. refuses when the `app.registrationEnabled` site setting is off, validates the form with Zod (`plan` is one of `FREE`, `STARTER`, `PRO`; `interval` is `monthly` or `annual`) and applies the `registration` rate limit per IP;
2. calls `auth.api.signUpEmail`. With `autoSignIn` on and no verification requirement, the account is created and signed in in a single step;
3. stores a non-free choice in the `quotecue.plan` cookie (`PENDING_PLAN_COOKIE`, `src/lib/billing/pending-plan.ts`) as `<PLAN>:<interval>`; the cookie is `httpOnly`, `sameSite=lax`, `secure` in production and expires after 24 hours;
4. sends the `WELCOME` email (a failure is logged, not shown to the user) and records the `registration_started` and `registration_completed` events;
5. redirects to `/onboarding`.

There is no verification step and no "check your email" screen. The `VERIFY_EMAIL` template still exists in `EmailTemplate`, but nothing sends it.

### The plan chosen at sign-up

A subscription belongs to a workspace, and the workspace does not exist until onboarding finishes, so the choice travels in the cookie rather than in the database. `completeOnboardingAction` (`src/app/onboarding/actions.ts`) creates the workspace and then calls its `redirectForPendingPlan` helper, which:

- returns the normal destination when the cookie is missing or holds anything other than `STARTER` or `PRO`, so a FREE sign-up lands on `/app?welcome=1` (or on the sample quote's wizard step when one was created) exactly as before;
- otherwise deletes the cookie and calls `createCheckoutSession` for that plan (`annual` maps to the `YEAR` interval, anything else to `MONTH`), returning the Stripe Checkout URL, or the mock checkout URL when Stripe is not configured;
- falls back to `/app/billing?checkout=unavailable` when the checkout session cannot be created, so a billing outage leaves the user inside the app with a working trial rather than stuck in onboarding.

The helper also runs on the early-return path taken when the user already has a workspace (a double click or a reload), so the choice is not dropped. `completeOnboardingAction` issues the `redirect()` itself on the server rather than returning a destination for the client to navigate to.

### Server actions and enumeration safety

`src/app/(auth)/actions.ts` wraps the Better Auth API and adds:

- Zod validation with field errors.
- Database-backed rate limits (`registration` 5/10 min per IP, `login` 10/10 min per IP+email, `passwordReset` 5/15 min, `magicLink` 5/15 min).
- Generic responses that do not reveal whether an address is registered: password reset and magic link always return the same message whether or not the account exists.
- Sign-up is the deliberate exception. An address that is already registered returns "An account already exists for that email address. Sign in instead, or reset your password." Sign-up now signs the visitor in, so the previous silent success (which also sent an `ACCOUNT_EXISTS` email) would leave them on a form that appeared to work and led nowhere. The trade-off is recorded in [SECURITY.md](SECURITY.md). Nothing sends the `ACCOUNT_EXISTS` template any more.
- Login errors are reduced to "Incorrect email or password". The branch that reports an unverified address is unreachable while `requireEmailVerification` is false.
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
