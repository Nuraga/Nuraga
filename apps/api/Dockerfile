# Build context is the repo ROOT (pnpm workspace), not apps/api — see
# docker-compose.prod.yml. Two stages: build (full pnpm install incl.
# devDependencies, so `pnpm exec ts-node prisma/seed.ts` still works from the
# final image for the initial demo seed) and runtime (same base, just no
# leftover build-only apt state).
FROM node:20-alpine AS build
RUN corepack enable
# argon2 has a native addon; alpine needs a toolchain to build/install it.
RUN apk add --no-cache python3 make g++
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @detsad/api prisma:generate
RUN pnpm --filter @detsad/api build

FROM node:20-alpine AS runtime
RUN corepack enable
# Prisma's query/schema engine binaries need libssl; without it `prisma
# migrate deploy` fails at runtime with a cryptic "Could not parse schema
# engine response" (confirmed by testing this image against a real Postgres).
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3000

# Apply pending migrations, then start. Safe to run on every boot: Prisma
# tracks applied migrations and no-ops if there's nothing new.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
