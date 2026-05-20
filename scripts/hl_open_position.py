"""Open a small BTC perp position on Hyperliquid testnet via signed L1 action."""
import os
import sys
import json
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants
from eth_account import Account

pk = os.environ.get("HYPERLIQUID_TESTNET_WALLET") or os.environ.get("HYPERLIQUID_TESTNET_WALLET_PRIVATE_KEY")
if not pk:
    sys.exit("missing HYPERLIQUID_TESTNET_WALLET env")

acct = Account.from_key(pk if pk.startswith("0x") else "0x" + pk)
print(f"[hl] wallet: {acct.address}", flush=True)

info = Info(constants.TESTNET_API_URL, skip_ws=True)
ex = Exchange(acct, constants.TESTNET_API_URL)

# Inspect existing state
state = info.user_state(acct.address)
print(f"[hl] perps equity:    {state['marginSummary']['accountValue']}", flush=True)
print(f"[hl] perps positions: {len(state['assetPositions'])}", flush=True)

spot = info.spot_user_state(acct.address)
usdc = next((b for b in spot["balances"] if b["coin"] == "USDC"), {"total":"0"})
print(f"[hl] spot USDC:       {usdc['total']}", flush=True)

# Open a tiny BTC perp long.
# Market order via IOC. Mid price queried; we'll cross the book by 0.5%.
all_mids = info.all_mids()
btc_mid = float(all_mids["BTC"])
target_size = 0.0002  # ~$20 notional at $100k BTC
# BTC tick size on HL is $1 — must be integer
limit_px = int(round(btc_mid * 1.005))
print(f"[hl] mid={btc_mid}  limit={limit_px}  size={target_size}", flush=True)

result = ex.order(
    "BTC",
    True,            # isBuy
    target_size,     # size
    limit_px,        # limit_px
    {"limit": {"tif": "Ioc"}},
    reduce_only=False,
)
print("[hl] order response:", json.dumps(result, indent=2), flush=True)

# Re-query state
state2 = info.user_state(acct.address)
print(f"[hl] perps equity now:    {state2['marginSummary']['accountValue']}", flush=True)
print(f"[hl] perps positions now: {len(state2['assetPositions'])}", flush=True)
for p in state2.get("assetPositions", []):
    pos = p["position"]
    print(f"      {pos.get('coin')} szi={pos.get('szi')} entry={pos.get('entryPx')} unrealized={pos.get('unrealizedPnl')}", flush=True)
