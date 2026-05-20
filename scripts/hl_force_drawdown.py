"""Open a moderately leveraged BTC long so normal market noise can trigger
the supervisor's WATCH threshold (3% drawdown from peak)."""
import os, sys, json, time
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants
from eth_account import Account

pk = os.environ.get("HYPERLIQUID_TESTNET_WALLET") or os.environ.get("HYPERLIQUID_TESTNET_WALLET_PRIVATE_KEY")
acct = Account.from_key(pk if pk.startswith("0x") else "0x" + pk)
info = Info(constants.TESTNET_API_URL, skip_ws=True)
ex = Exchange(acct, constants.TESTNET_API_URL)

# Try 5x leverage on BTC. Higher leverage → small market moves cause big drawdown.
try:
    print(ex.update_leverage(5, "BTC", True))  # is_cross=True
except Exception as e:
    print(f"[hl] leverage update: {e}")

# Open a bigger BTC long: 0.001 BTC (~$77 notional, requires ~$15 margin at 5x)
mid = float(info.all_mids()["BTC"])
limit_px = int(round(mid * 1.005))
print(f"[hl] mid={mid}  limit={limit_px}  size=0.001 (~$77 notional)")
result = ex.order("BTC", True, 0.001, limit_px, {"limit": {"tif": "Ioc"}}, reduce_only=False)
print("[hl] order result:", json.dumps(result, indent=2))

time.sleep(2)
state = info.user_state(acct.address)
print(f"[hl] perps equity now: {state['marginSummary']['accountValue']}")
print(f"[hl] cross equity:     {state.get('crossMarginSummary', {}).get('accountValue')}")
for p in state.get("assetPositions", []):
    pos = p["position"]
    print(f"      {pos.get('coin')} szi={pos.get('szi')} entry={pos.get('entryPx')} leverage={pos.get('leverage')} unrealized={pos.get('unrealizedPnl')}")
