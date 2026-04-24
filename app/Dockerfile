# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────
# Debrief Next.js container for AWS App Runner (ca-central-1)
#
# Multi-stage build: deps → builder → runner
# Uses bun for install + build to match the repo's bun.lock.
# Final stage runs Next.js standalone output as a non-root user.
# ──────────────────────────────────────────────────────────────

# ── deps ───────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat \
    && npm install -g bun@1.1.42
WORKDIR /app

# Only copy lockfile + manifest so this layer caches on unrelated changes.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── builder ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat \
    && npm install -g bun@1.1.42
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry off — we don't want anonymous Next.js pings from the container.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN bun run build

# ── runner ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# App Runner conventions: listen on 0.0.0.0:3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user (uid/gid 1001 to match common Next.js Docker examples)
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the minimal standalone server + static assets + public folder.
# The standalone output already bundles only the production deps it needs,
# so we do NOT copy node_modules or package.json from the builder.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# server.js is the bootstrap file emitted by `output: 'standalone'`.
CMD ["node", "server.js"]
