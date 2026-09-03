#!/bin/sh
# Entrypoint for the QuoteCue AI image.
#   web      - apply migrations, then start the Next.js standalone server (default)
#   jobs     - run the cron job runner once and exit
#   migrate  - apply pending Prisma migrations and exit
#   seed     - load platform data once (plans, prompts, templates, flags)
set -e

is_true() {
  case "$1" in
    true|TRUE|True|1|yes) return 0 ;;
    *) return 1 ;;
  esac
}

run_migrations() {
  NODE_PATH=/app/jobs_node_modules node /app/jobs_node_modules/prisma/build/index.js migrate deploy
}

run_seed() {
  NODE_PATH=/app/jobs_node_modules node /app/dist/seed.js
}

case "${1:-web}" in
  web)
    # Migrations are applied before serving so a fresh deployment comes up with
    # a usable schema instead of failing every request with "table does not
    # exist". Prisma takes an advisory lock, so extra replicas wait rather than
    # race. Set SKIP_MIGRATIONS_ON_START=true where a separate pre-deploy step
    # or a DBA owns schema changes.
    if is_true "$SKIP_MIGRATIONS_ON_START"; then
      echo "[entrypoint] SKIP_MIGRATIONS_ON_START is set; not applying migrations"
    else
      echo "[entrypoint] applying database migrations"
      run_migrations
    fi
    # Seeding stays opt-in: it writes reference data, so it is never automatic.
    if is_true "$SEED_ON_START"; then
      echo "[entrypoint] SEED_ON_START is set; seeding platform data (idempotent)"
      run_seed
    fi
    exec node server.js
    ;;
  jobs)
    shift
    export NODE_PATH=/app/jobs_node_modules
    exec node dist/jobs/run.js "$@"
    ;;
  migrate)
    run_migrations
    ;;
  seed)
    run_seed
    ;;
  *)
    exec "$@"
    ;;
esac
