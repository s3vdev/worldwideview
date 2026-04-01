# Stage 0: Extract package.json files for layer caching
FROM alpine AS extractor
WORKDIR /app
COPY . .
RUN find . -type f \! -name 'package.json' \! -name 'pnpm-workspace.yaml' \! -name 'pnpm-lock.yaml' -delete && \
    find . -type d -empty -delete

# Stage 1: Install ALL dependencies (needed for build)
FROM node:22-alpine AS deps
RUN corepack enable pnpm
RUN apk add --no-cache python3 make g++
WORKDIR /app
# Copy only the extracted package.jsons
COPY --from=extractor /app ./
# Install dependencies with cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# Stage 2: Install PRODUCTION-ONLY dependencies (for runtime)
FROM node:22-alpine AS proddeps
RUN corepack enable pnpm
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY --from=extractor /app ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --prod --frozen-lockfile

# Stage 3: Build the application
FROM deps AS builder
# Copy full source code
COPY . .
RUN npx prisma generate

# Create an empty SQLite database with all tables applied
RUN mkdir -p ./data && DATABASE_URL=file:./data/wwv.db npx prisma migrate deploy

# Run Next.js build with Webpack cache mounted
RUN --mount=type=cache,target=/app/.next/cache pnpm run build
RUN node scripts/copy-cesium.mjs

# Stage 4: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:./data/wwv.db
ENV AUTH_TRUST_HOST=true

# Copy Prisma schema + migrations for runtime DB init
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy Prisma generated client
COPY --from=builder /app/src/generated ./src/generated

# Copy standalone server output
COPY --from=builder /app/.next/standalone ./

# Copy production-only node_modules
COPY --from=proddeps /app/node_modules ./node_modules

# Copy workspace packages (production node_modules for hoisted dependencies)
# Wait, pnpm workspaces might hoist prod packages to the root, but we also need local packages mapped
# Our standalone output copies everything correctly into app/.next/standalone!
# The only issue is native modules in node_modules? NO .next/standalone includes node_modules!
# Wait, Next.js output: "standalone" automatically copies required node_modules inside .next/standalone!
# The original Dockerfile had COPY --from=proddeps /app/node_modules ./node_modules but standalone already has it.
# We will keep the original logic since it worked before.

# Copy static assets that standalone mode does NOT include
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Entrypoint: migrate DB on first run, then start server
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Declare /app/data as a persistent volume mount point.
VOLUME ["/app/data"]

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
