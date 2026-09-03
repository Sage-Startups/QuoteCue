#!/bin/sh
# Entrypoint for the QuoteCue AI image.
#   web      - start the Next.js standalone server (default)
#   jobs     - run the cron job runner once and exit
#   migrate  - apply pending Prisma migrations (used as Railway pre-deploy command)
set -e
case "${1:-web}" in
  web)
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
  *)
    exec "$@"
    ;;
esac
