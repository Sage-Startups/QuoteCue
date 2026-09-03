# Cron service and background jobs

QuoteCue AI has no in-process queue. Everything that must happen later is an idempotent job in `src/jobs/registry.ts`, executed by the runner in `src/jobs/run.ts`. On Railway the runner is a **second service built from the same repository and Docker image** as the web service, started on a cron schedule; it runs every job once and exits.

## Railway set-up

1. In the Railway project, add a new service from the same GitHub repository (Railway builds it with the same `Dockerfile`).
2. Set the **start command** to `./docker/entrypoint.sh jobs` (the image's default command is `web`). `entrypoint.sh` sets `NODE_PATH=/app/jobs_node_modules` and runs `node dist/jobs/run.js`, the esbuild bundle produced by `pnpm jobs:build` during the image build.
3. Set a **cron schedule**, for example `0 * * * *` (hourly). Daily (`0 3 * * *`) is enough for expiry, retention and analytics, but hourly keeps quote expiry, reminders and the demo reset timely. The heartbeat is considered stale after 26 hours, so do not schedule less often than daily.
4. Give the service the **same environment variables as the web service** (reference the shared values or use Railway shared variables): at minimum `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `NODE_ENV=production`, the five `STORAGE_*` variables with `STORAGE_PROVIDER=railway`, `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY` and `DEMO_MODE`. The runner loads `src/lib/env.ts`, so production validation applies: it refuses to run with mock providers or local storage. `send-expiry-reminders` needs Resend and `ensurePublicLink` needs `APP_URL` to build customer links.
5. No health check, domain or public networking is needed. Leave "restart on exit" at Railway's default for cron services; the process is expected to exit after each run.

Railway's `RAILWAY_SERVICE_NAME` is recorded by the heartbeat job so you can see which service produced a run.

## Verifying the runner

The cron service runs `dist/jobs/run.js`, an esbuild bundle rather than the TypeScript the tests import, so check the bundle itself after changing the build:

```bash
pnpm jobs:build
node dist/jobs/run.js --list     # loads the whole module graph, touches no database
```

`tests/unit/jobs-bundle.test.ts` runs that check on every `pnpm test`. It exists because the bundle once loaded `import.meta.url` as undefined under CommonJS, which made the generated Prisma client throw on load and every cron run crash while all source-level tests passed.


## Locking and overlapping runs

`runAllJobs` takes the PostgreSQL session advisory lock `pg_try_advisory_lock(7420261)` before running anything and releases it in a `finally` block. If the lock is already held (a previous run is still going, or someone started `pnpm jobs:run` by hand), the runner writes a `BackgroundJobRun` row with `jobName = "runner"`, status `SKIPPED` and the error "Another runner holds the advisory lock", logs a warning and exits **0**. Jobs therefore never execute concurrently, and a slow job simply delays the next schedule rather than doubling up.

## Job execution and records

Every run has a `runId` (UUID). For each selected job the runner:

1. creates a `BackgroundJobRun` row (`jobName`, `runId`, status `RUNNING`, `host`);
2. calls `job.run({ now, log })`; `log()` lines are echoed to stdout with a `[jobs] <name>:` prefix and kept in the result;
3. on success updates the row to `SUCCEEDED` with `finishedAt`, `durationMs` and the job's result object (plus `logs`);
4. on failure updates it to `FAILED` with the error message (first 4,000 characters), logs the error and continues with the next job.

All jobs receive the same `now`, so a run is internally consistent.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | All selected jobs succeeded, or the run was skipped because another runner holds the lock, or `--list` was used |
| `1` | At least one job failed (`process.exitCode = 1`), or the runner itself crashed before/while acquiring the lock (`[jobs] fatal`) |

`SIGTERM`/`SIGINT` only log a warning; the current job finishes and the process exits normally. Prisma disconnects in `finally`.

## The jobs

Listed in execution order (`JOBS` in `registry.ts`; `pnpm jobs:run --list` prints the same names and descriptions).

| Job | What it does | Idempotency and limits |
| --- | --- | --- |
| `expire-overdue-quotes` | Moves `SENT`/`VIEWED` quotes whose `expiresAt` has passed to `EXPIRED` and adds an `EXPIRED` timeline event (actor `SYSTEM`) | Conditional `updateMany` on the status, so a quote is expired once; 500 per run. The public page also expires quotes lazily when opened |
| `send-expiry-reminders` | Emails `QUOTE_EXPIRY_REMINDER` to customers whose quote expires within `email.quoteReminderDaysBefore` days (default 3), for active non-demo workspaces and customers with an email address; adds a `REMINDER_SENT` event | Claims the quote by setting `reminderSentAt` where it is null before sending, so each quote gets at most one reminder; 200 per run |
| `clean-expired-uploads` | Deletes bucket objects of `PENDING` uploads older than `app.uploadRetentionDays` (default 1) and marks them `EXPIRED`; hard-deletes `EXPIRED`/`FAILED` upload rows untouched for 30 days | Safe to repeat; missing objects are ignored; 500 per run |
| `process-retention` | Removes media of quotes archived for more than `app.dataRetentionDays` (default 730) and soft-deletes their `StoredObject`; purges objects soft-deleted more than 7 days ago; completes deletion of workspaces in `PENDING_DELETION` for over 30 days (`deleteWorkspaceCompletely`, including bucket objects) | Uses `deletedAt` markers so each object is processed once; 500 per query |
| `aggregate-daily-analytics` | Upserts `WorkspaceDailyStat` for yesterday and today for every workspace (`aggregateDailyStats`) | Upsert keyed by workspace and day; re-running recalculates |
| `record-storage-usage` | Writes a `StorageUsageSnapshot` per workspace and one platform-wide row (`workspaceId` null); deletes snapshots older than 400 days | Appends one snapshot per run; running more often simply records more points |
| `cleanup-sessions` | Ends expired `SupportSession`s, deletes expired auth `Session` and `Verification` rows, deletes `RateLimitBucket` rows older than one day, strips stored preview HTML from `EmailEvent`s older than 14 days, marks expired `WorkspaceInvite`s `EXPIRED` | Pure clean-up; safe to repeat |
| `reset-demo-workspace` | When `DEMO_MODE=true`, rebuilds the Northstar Electrical Services demo workspace (`seedDemoWorkspace`) if the last successful reset is older than `app.demoResetHours` (default 24) | Returns `{ skipped }` without `DEMO_MODE`, `{ reset: false, ageHours }` when too recent; the seed deletes and recreates the workspace, so it is safe to repeat |
| `heartbeat` | Records `{ at, host }` | Used by `/api/health/system` and the super-admin overview: the latest `SUCCEEDED` heartbeat must be under 26 hours old |

Adding a job: export a `JobDefinition` (`name`, `description`, `run`) in `registry.ts` and add it to `JOBS`. Keep it idempotent (claim rows with conditional updates, bound the batch size) because a failed run will be retried on the next schedule with the same data.

## Monitoring

- **Database**: `BackgroundJobRun` (indexed by job name, run id and status). Recent runs:

  ```sql
  SELECT "jobName", status, "startedAt", "durationMs", error, result
  FROM "BackgroundJobRun" ORDER BY "startedAt" DESC LIMIT 30;
  ```

  Failures over the last day:

  ```sql
  SELECT "jobName", "startedAt", error FROM "BackgroundJobRun"
  WHERE status = 'FAILED' AND "startedAt" > NOW() - INTERVAL '1 day';
  ```

- **Super-admin console**: the overview shows the last heartbeat and flags it when stale. The dedicated `/super-admin/jobs` page is part of the planned console navigation but has no page in this build; use the queries above until it exists.
- **System health**: `GET /api/health/system` includes `checks.cron` with "Last heartbeat N minutes ago".
- **Railway**: the cron service's deployment logs contain the `[jobs]` lines and the exit code of every run; set up a Railway alert on failed deployments/non-zero exits if you want notifications.

## Running locally

```bash
pnpm jobs:run --list                              # print job names and descriptions
pnpm jobs:run                                     # run every job once against DATABASE_URL in .env
pnpm jobs:run --only heartbeat,cleanup-sessions   # comma-separated subset
```

`pnpm jobs:run` executes `tsx src/jobs/run.ts` with `.env` loaded by `dotenv`. In development the runner uses the same mock providers as the web app (email previews, local storage), which it announces on start: `[jobs] starting (development, storage=local, email=preview)`. To test the production bundle, run `pnpm jobs:build` and then `node dist/jobs/run.js --list`.

Because the advisory lock is shared, a local run against the production database would block or be blocked by the Railway cron service; avoid pointing a local runner at production except for deliberate one-off maintenance.
