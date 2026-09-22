# syntax=docker/dockerfile:1

# Debian, not Alpine: argon2 resolves prebuilt binaries per platform and
# pnpm-workspace.yaml forbids install scripts, so there is no build-from-source
# fallback and a musl base would leave it without a binary.
FROM node:22-bookworm-slim AS base
# Corepack otherwise prompts for confirmation and hangs a non-interactive build.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Every `prisma` command resolves its datasource through prisma.config.ts, which
# reads DIRECT_URL with env() and throws when it is missing — including the
# `prisma generate` that postinstall runs. Nothing here connects, so a
# syntactically valid placeholder is enough and no real credential belongs in a
# build layer. The runtime values come from the container's environment.
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build \
    DATABASE_URL=postgresql://build:build@localhost:5432/build

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# postinstall already generated the client, but src/generated is gitignored and
# the build depends on it, so a silent miss here would surface as a type error
# far from its cause.
RUN pnpm db:generate && pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3001

# node_modules ships whole, dev dependencies included. Trimming to production
# would be smaller but would also make the image unable to migrate: `prisma
# migrate deploy` needs the prisma CLI, tsx and dotenv to read prisma.config.ts,
# and all three are dev dependencies.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json /app/prisma.config.ts ./

USER node
EXPOSE 3001

# Node's own fetch, so the image needs no curl or wget. The endpoint answers 503
# when the database is unreachable, so this probe covers the dependency too.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# main.ts calls enableShutdownHooks(), so SIGTERM from `docker stop` closes the
# Prisma pool instead of being killed after the grace period.
CMD ["node", "dist/main"]
