#!/bin/sh
# Rehearses the Docker image's directory layout without a Docker daemon.
#
# The image copies dist/ to /app/jobs with the production node_modules beside
# it. Running the bundles from the repository root hides resolution failures,
# because node_modules is adjacent there by accident: a bundle that works in
# `pnpm test` crashed in production with "Cannot find package '@prisma/client'".
# This script builds the bundles, assembles the real layout in a temporary
# directory and runs every entrypoint mode against DATABASE_URL.
set -e
: "${DATABASE_URL:?set DATABASE_URL to a scratch database}"
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

pnpm --dir "$root" jobs:build >/dev/null
mkdir -p "$work/app/docker"
cp -r "$root/dist" "$work/app/jobs"
ln -s "$root/node_modules" "$work/app/jobs/node_modules"
cp -r "$root/prisma" "$work/app/prisma"
cp "$root/prisma.config.ts" "$work/app/"
cp "$root/docker/entrypoint.sh" "$work/app/docker/"
echo 'console.log("[server] listening")' > "$work/app/server.js"
# The entrypoint uses absolute /app paths, exactly as it does in the container.
sed -i "s#/app/jobs#$work/app/jobs#g" "$work/app/docker/entrypoint.sh"

cd "$work/app"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-image-layout-check-secret-32-chars-min-0}"
export APP_URL="${APP_URL:-http://localhost:3000}"
export STORAGE_PROVIDER=memory ALLOW_MOCK_PROVIDERS=true

echo "--- migrate ---"; sh docker/entrypoint.sh migrate >/dev/null
echo "--- seed ---";    sh docker/entrypoint.sh seed >/dev/null
echo "--- jobs ---";    sh docker/entrypoint.sh jobs >/dev/null
echo "image layout OK: migrate, seed and jobs all resolve their dependencies"
