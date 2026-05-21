# Docker setup

One image. One container. Both the supervisor agent and the UI run inside
it via a small entrypoint script.

## Layout

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build: Bun installs the agent workspace + builds the UI worker bundle; runtime is `node:22-slim` with Bun layered on. |
| `docker-entrypoint.sh` | Starts agent (Bun) and UI (wrangler/workerd under Node) in parallel; container exits if either dies. |
| `docker-compose.yml` | Single `mirror` service; loads `.env` and exposes `:8080`. |
| `.dockerignore` | Excludes `.env`, `node_modules`, `dist`, `.git`. |

## Run

```sh
docker compose up -d --build
docker compose logs -f mirror
open http://localhost:8080
docker compose down
```

## Build the image directly

amd64 is pinned on every `FROM`. On Apple Silicon, use buildx:

```sh
docker buildx build --platform linux/amd64 -t mirror:latest --load .
docker run --rm -p 8080:8080 --env-file .env mirror:latest
```

## Push to a registry

```sh
docker tag mirror:latest <registry>/mirror:<tag>
docker push <registry>/mirror:<tag>
```

## Notes

- `bunfig.toml` (`ignoreScripts = true`) is honored inside the image — npm postinstall hooks are blocked at install time.
- The UI build uses a Docker-only bunfig that drops `minimumReleaseAge` (the lockfile already pins versions; the 24h registry guard is redundant in CI).
- The runtime carries both Node and Bun: Node runs wrangler/workerd for the UI; Bun runs the supervisor. Wrangler explicitly refuses to run under Bun, so Node is required for the UI side.
- The UI runs on workerd (real Cloudflare Workers runtime, shipped inside wrangler). No SSR config changes were needed.
- Secrets stay in `.env` at the repo root; never baked into image layers.
- Container exits if either process dies; `restart: unless-stopped` recovers the pair.
