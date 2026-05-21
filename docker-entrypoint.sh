#!/usr/bin/env bash
#
# Mirror runtime entrypoint — starts the supervisor agent and the UI side by
# side. If either process exits, the container exits too so docker's restart
# policy can recover the whole thing cleanly.

set -uo pipefail

AGENT_PID=""
UI_PID=""

cleanup() {
  trap - SIGTERM SIGINT EXIT
  [[ -n "$AGENT_PID" ]] && kill -TERM "$AGENT_PID" 2>/dev/null || true
  [[ -n "$UI_PID"    ]] && kill -TERM "$UI_PID"    2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup SIGTERM SIGINT EXIT

echo "[mirror] starting supervisor agent (bun)..."
(
  cd /app/agent
  exec bun run agent/src/index.ts
) &
AGENT_PID=$!

echo "[mirror] starting UI on :8080 (wrangler / workerd under node)..."
(
  cd /app/ui
  exec npx wrangler dev \
      --config dist/server/wrangler.json \
      --ip 0.0.0.0 \
      --port 8080 \
      --show-interactive-dev-session=false
) &
UI_PID=$!

# Wait for the first child to exit, then propagate.
wait -n "$AGENT_PID" "$UI_PID"
EXIT_CODE=$?
echo "[mirror] a child exited (code $EXIT_CODE); tearing down."
exit "$EXIT_CODE"
