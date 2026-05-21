# syntax=docker/dockerfile:1.7
#
# Mirror Protocol — single image, two co-located processes:
#   • supervisor agent (Bun)  — reads HL + Arc telemetry, writes evaluate()
#     and executeSlash() txs against RiskCircuitBreaker on Arc testnet.
#   • UI (workerd via wrangler under Node) — TanStack Start app on :8080.
#
# Build:
#   docker buildx build --platform linux/amd64 -t mirror:latest --load .
# Run:
#   docker run --rm -p 8080:8080 --env-file .env mirror:latest

##################################################
# Stage 1 — agent workspace install (Bun)        #
##################################################
FROM --platform=linux/amd64 oven/bun:1.1.34-alpine AS agent-deps
WORKDIR /workspace
COPY package.json bun.lock bunfig.toml ./
COPY agent/package.json ./agent/
COPY app/package.json ./app/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

##################################################
# Stage 2 — build the UI worker bundle (Bun)     #
##################################################
FROM --platform=linux/amd64 oven/bun:1.2-debian AS ui-builder
WORKDIR /ui
COPY app/mirror-guard-arc/package.json app/mirror-guard-arc/bun.lock ./
# Docker-only bunfig: keeps ignoreScripts=true (postinstall hooks blocked)
# but drops minimumReleaseAge — the lockfile already pins every version, so
# the host's 24h registry-publish guard is redundant during an image build.
RUN printf '[install]\nignoreScripts = true\nsaveExact = true\nregistry = "https://registry.npmjs.org/"\n' > bunfig.toml
RUN bun install --frozen-lockfile
COPY app/mirror-guard-arc/ ./
RUN printf '[install]\nignoreScripts = true\nsaveExact = true\nregistry = "https://registry.npmjs.org/"\n' > bunfig.toml
RUN bun run build

##################################################
# Stage 3 — runtime: Node (wrangler) + Bun (agent)
##################################################
FROM --platform=linux/amd64 node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV CI=1

# Bun pinned to the same version used at install time. npm is the official
# distribution channel; the resulting binary is the same as `curl bun.sh/install`.
RUN npm install -g bun@1.1.34 \
    && npm cache clean --force

# Agent: workspace node_modules (with @mirror/shared symlink) + source.
COPY --from=agent-deps /workspace/node_modules ./agent/node_modules
COPY package.json bunfig.toml ./agent/
COPY agent ./agent/agent
COPY packages/shared ./agent/packages/shared

# UI: built worker bundle + node_modules (wrangler reads them at runtime).
COPY --from=ui-builder /ui/dist ./ui/dist
COPY --from=ui-builder /ui/node_modules ./ui/node_modules
COPY --from=ui-builder /ui/package.json ./ui/package.json

# Entrypoint runs both processes in parallel; if either exits, container exits.
COPY docker-entrypoint.sh /usr/local/bin/mirror-start
RUN chmod +x /usr/local/bin/mirror-start

# Unprivileged user with a writable HOME (wrangler writes logs under ~/.config).
RUN groupadd --system app \
    && useradd --system --gid app --create-home --home-dir /home/app app \
    && chown -R app:app /app /home/app
USER app

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/mirror-start"]
