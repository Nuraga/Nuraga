# Build context is the repo ROOT (pnpm workspace) — see docker-compose.prod.yml.
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @detsad/web build

# Final image is just Caddy serving the static build + reverse-proxying
# /api/* to the api container. One public-facing container, auto-HTTPS via
# Let's Encrypt (needs the domain's DNS already pointed here on first boot).
FROM caddy:2-alpine
COPY --from=build /repo/apps/web/dist /srv/web
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
