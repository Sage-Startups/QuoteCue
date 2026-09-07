#!/bin/sh
# Entrypoint for the QuoteCue AI image.
#   web      - apply migrations, then start the Next.js standalone server (default)
#   jobs     - run the cron job runner once and exit
#   migrate  - apply pending Prisma migrations and exit
#   seed     - load platform data once (plans, prompts, templates, flags)
#
# The bundles live in /app/jobs with the production node_modules beside them, so
# both `require` and the dynamic `import()` inside the Prisma client resolve by
# walking up from the bundle. NODE_PATH is not enough: it does not apply to ESM.
set -e

# Both resolution mechanisms are needed. NODE_PATH lets the Prisma CLI's
# CommonJS `require("prisma/config")` find its own package; the bundles sit in
# the same directory as node_modules because NODE_PATH does not apply to the
# dynamic `import()` the Prisma client uses at query time.
export NODE_PATH=/app/jobs/node_modules

is_true() {
  case "$1" in
    true|TRUE|True|1|yes) return 0 ;;
    *) return 1 ;;
  esac
}

run_migrations() {
  node /app/jobs/node_modules/prisma/build/index.js migrate deploy
}

run_seed() {
  node /app/jobs/seed.js
}

case "${1:-web}" in
  web)
    # Migrations run before serving so a fresh deployment comes up with a usable
    # schema. Prisma takes an advisory lock, so replicas wait rather than race.
    # Set SKIP_MIGRATIONS_ON_START=true where a pre-deploy step owns them.
    if is_true "$SKIP_MIGRATIONS_ON_START"; then
      echo "[entrypoint] SKIP_MIGRATIONS_ON_START is set; not applying migrations"
    else
      echo "[entrypoint] applying database migrations"
      run_migrations
    fi
    # Seeding is opt-in and never fatal: it only loads reference data, so a
    # failure here must not take the site down or start a restart loop.
    if is_true "$SEED_ON_START"; then
      echo "[entrypoint] SEED_ON_START is set; seeding platform data (idempotent)"
      if ! run_seed; then
        echo "[entrypoint] WARNING: seeding failed; starting the server anyway. Run './docker/entrypoint.sh seed' to retry."
      fi
    fi
    exec node server.js
    ;;
  jobs)
    shift
    exec node /app/jobs/run.js "$@"
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
