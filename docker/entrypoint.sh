#!/bin/sh
# Entrypoint for the QuoteCue AI image.
#   web      - start the Next.js standalone server (default)
#   jobs     - run the cron job runner once and exit
#   migrate  - apply pending Prisma migrations (Railway pre-deploy command)
#   seed     - load platform data once (plans, prompts, templates, flags)
set -e

run_migrations() {
  NODE_PATH=/app/jobs_node_modules node /app/jobs_node_modules/prisma/build/index.js migrate deploy
}

case "${1:-web}" in
  web)
    # Opt-in convenience for deployments without a pre-deploy step: apply
    # migrations before serving. Prisma takes an advisory lock, so concurrent
    # replicas wait rather than race. Leave unset to keep deploys read-only.
    if [ "$RUN_MIGRATIONS_ON_START" = "true" ] || [ "$RUN_MIGRATIONS_ON_START" = "1" ]; then
      echo "[entrypoint] RUN_MIGRATIONS_ON_START is set; applying migrations"
      run_migrations
    fi
    exec node server.js
    ;;
  jobs)
    shift
    export NODE_PATH=/app/jobs_node_modules
    exec node dist/jobs/run.js "$@"
    ;;
  migrate)
    export NODE_PATH=/app/jobs_node_modules
    exec node /app/jobs_node_modules/prisma/build/index.js migrate deploy
    ;;
  seed)
    export NODE_PATH=/app/jobs_node_modules
    exec node dist/seed.js
    ;;
  *)
    exec "$@"
    ;;
esac
