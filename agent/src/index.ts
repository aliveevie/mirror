import { addressesFromEnv } from "@mirror/shared";
import { runSupervisor } from "./loop.ts";
import { makeAgentWalletFromEnv } from "./wallet.ts";
import { hyperliquidConnector } from "./venues/hyperliquid.ts";
import { hyperliquidMarketSnapshot } from "./market/hyperliquidMacro.ts";

async function main() {
  const wallet = makeAgentWalletFromEnv();
  const addresses = addressesFromEnv();

  const leadersEnv = (process.env.WATCHED_LEADERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (leadersEnv.length === 0) {
    throw new Error("WATCHED_LEADERS env (comma-separated 0x addresses) is required");
  }

  await runSupervisor({
    wallet,
    addresses,
    leaders: leadersEnv as `0x${string}`[],
    connectors: [hyperliquidConnector()],
    market: hyperliquidMarketSnapshot,
    intervalMs: Number(process.env.LOOP_INTERVAL_MS ?? 30_000),
  });
}

main().catch((e) => {
  console.error("[supervisor] fatal", e);
  process.exit(1);
});
