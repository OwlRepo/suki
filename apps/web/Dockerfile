# Web app: Next.js 16
# Targets: dev (HMR, bind-mount source) | prod (standalone image)

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

# --- dev target: run next dev with bind-mounted source ---
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/api/package.json ./apps/web/ ./apps/api/
COPY packages/ ./packages/

# Build packages only (skip db:setup during image build)
RUN bunx turbo run build --filter=@tyvera/database --filter=@tyvera/types --filter=@tyvera/ui || true

WORKDIR /app

# Next dev with polling for reliable file watch in Docker (macOS/Windows)
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true

EXPOSE 3000

# Ensure deps exist when using node_modules volume; then run web dev from monorepo root
ENTRYPOINT ["sh", "-c", "cd /app && (test -d node_modules/next && test -d node_modules/recharts || bun install) && cd apps/web && exec bun run dev"]

# --- prod target: build and serve ---
FROM base AS prod
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build entire workspace for web (includes packages + web)
ENV NODE_ENV=production
RUN bunx turbo run build --filter=@tyvera/web...

WORKDIR /app/apps/web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD ["sh", "-c", "wget -q -O /dev/null \"http://127.0.0.1:${PORT:-3000}/\" || exit 1"]
CMD ["sh", "-c", "exec bun run start -- -H 0.0.0.0"]
