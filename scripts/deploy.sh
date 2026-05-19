#!/usr/bin/env bash
# -----------------------------------------------------------------
# Mirror Protocol — Arc-testnet deployer.
#
# Reads addresses + role assignments from .env, broadcasts the
# init-once Deploy.s.sol against Arc, and prints the resulting
# 5 contract addresses ready to paste back into .env / app/.env.
#
# Prerequisites:
#   - .env filled out (see .env.example)
#   - Foundry installed (https://getfoundry.sh)
#   - A Foundry keystore for $DEPLOYER_ADDRESS (use `cast wallet import`)
#   - Some USDC on Arc testnet at $DEPLOYER_ADDRESS (Arc faucet at
#     https://faucet.circle.com — select "Arc")
# -----------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; source .env; set +a

: "${ARC_RPC_URL:?ARC_RPC_URL missing}"
: "${DEPLOYER_ADDRESS:?DEPLOYER_ADDRESS missing}"
: "${AGENT_WALLET:?AGENT_WALLET missing — set this to your Circle Developer-Controlled Wallet address}"

# Sanity-check that AGENT_WALLET has been changed from the default.
if [[ "$AGENT_WALLET" == "0xACE91A3F253FdDba383E65a2bAd50ebB1A92E5b3" || "$AGENT_WALLET" == "$DEPLOYER_ADDRESS" ]]; then
  echo "⚠️  AGENT_WALLET appears to equal the deployer EOA."
  echo "    For a real demo, set this to your Circle Developer-Controlled Wallet."
  read -r -p "Continue anyway? [y/N] " ans
  [[ "$ans" == "y" ]] || exit 1
fi

echo "→ Compiling contracts..."
(cd contracts && forge build)

echo "→ Broadcasting Deploy.s.sol to $ARC_RPC_URL ..."
(cd contracts && forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$ARC_RPC_URL" \
  --account deployer \
  --sender "$DEPLOYER_ADDRESS" \
  --broadcast \
  --legacy)

echo ""
echo "✓ Deploy complete. Copy the addresses above into:"
echo "    .env       (ADDR_LEADER_REGISTRY, ADDR_ALLOCATION_ROUTER, ...)"
echo "    app/.env   (VITE_ADDR_*)"
echo ""
