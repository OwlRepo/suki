# API app: NestJS 10
# Targets: dev (watch mode, bind-mount source) | prod (standalone image)

FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# --- deps stage: install workspace deps ---
FROM base AS deps
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
RUN bun install --frozen-lockfile

# --- dev target: run nest start --watch with bind-mounted source ---
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/api/package.json ./apps/web/ ./apps/api/
COPY packages/ ./packages/

# Build packages only (skip db:setup during image build)
RUN bunx turbo run build --filter=@suki/database --filter=@suki/types --filter=@suki/ui || true

WORKDIR /app

# Nest/Chokidar polling for reliable watch in Docker (macOS/Windows)
ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=500

EXPOSE 3001

# Ensure deps, run migrations, then start api dev.
# Run setup script directly with --no-env-file so Docker DATABASE_URL is not overwritten by .env (localhost).
ENTRYPOINT ["sh", "-c", "cd /app && (test -d node_modules/@nestjs/core || bun install) && bun run --no-env-file packages/database/scripts/setup.ts && cd apps/api && exec bun run dev"]

# --- prod target: build and serve ---
FROM base AS prod
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN bunx turbo run build --filter=@suki/api...

WORKDIR /app

# Run migrations (direct script so Docker DATABASE_URL is used), then start API
EXPOSE 3001
CMD ["sh", "-c", "bun run --no-env-file packages/database/scripts/migrate.ts && cd apps/api && exec bun run start"]
