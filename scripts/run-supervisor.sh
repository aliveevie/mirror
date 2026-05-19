#!/usr/bin/env bash
# -----------------------------------------------------------------
# Mirror Protocol — start the autonomous supervisor.
#
# Reads .env, validates required Circle + Arc + Hyperliquid env,
# and runs the agent loop. Defaults LOOP_INTERVAL_MS=15000 for a
# punchy demo.
# -----------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; source .env; set +a

: "${CIRCLE_API_KEY:?CIRCLE_API_KEY missing}"
: "${CIRCLE_ENTITY_SECRET:?CIRCLE_ENTITY_SECRET missing}"
: "${CIRCLE_AGENT_WALLET_ID:?CIRCLE_AGENT_WALLET_ID missing}"
: "${CIRCLE_AGENT_WALLET_ADDRESS:?CIRCLE_AGENT_WALLET_ADDRESS missing}"
: "${ADDR_RISK_CIRCUIT_BREAKER:?ADDR_RISK_CIRCUIT_BREAKER missing — run scripts/deploy.sh first}"
: "${WATCHED_LEADERS:?WATCHED_LEADERS missing — set this to one or more leader addresses, comma-separated}"

LOOP_INTERVAL_MS="${LOOP_INTERVAL_MS:-15000}"

echo "→ Mirror supervisor"
echo "    agent wallet:   $CIRCLE_AGENT_WALLET_ADDRESS"
echo "    watching:       $WATCHED_LEADERS"
echo "    breaker:        $ADDR_RISK_CIRCUIT_BREAKER"
echo "    loop interval:  ${LOOP_INTERVAL_MS}ms"
echo ""

LOOP_INTERVAL_MS="$LOOP_INTERVAL_MS" exec bun run agent/src/index.ts
