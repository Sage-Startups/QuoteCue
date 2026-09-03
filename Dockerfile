# syntax=docker/dockerfile:1.7
# QuoteCue AI - production image for Railway (web service and cron service share this image).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- Build ------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma needs a DATABASE_URL shape at generate time only; no connection is made.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-secret-not-used-at-runtime-0000" \
    SKIP_ENV_VALIDATION=1
RUN pnpm prisma generate && pnpm build && pnpm jobs:build
# Prune to production dependencies for the cron runner.
RUN pnpm prune --prod --ignore-scripts

# --- Runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs --home /app nextjs
WORKDIR /app

# Next.js standalone server (web service).
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Cron job runner: bundled entrypoint plus production node_modules and Prisma artefacts.
COPY --from=build --chown=nextjs:nodejs /app/dist/jobs ./dist/jobs
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./jobs_node_modules
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=nextjs:nodejs /app/docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "./docker/entrypoint.sh"]
# Default: web service. The cron service overrides the command with: jobs
CMD ["web"]
