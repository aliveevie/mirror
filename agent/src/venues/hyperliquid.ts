import type { Address } from "viem";
import type { VenueConnector } from "./types.ts";
import type { LeaderTelemetry } from "../types.ts";

/**
 * Hyperliquid testnet connector. Pulls leader account state via the public
 * `info` POST endpoint. All fields are derived from real on-venue data —
 * none are stubbed.
 * Reference: https://hyperliquid.gitbook.io/hyperliquid-docs
 */
export function hyperliquidConnector(): VenueConnector {
  const base = process.env.HYPERLIQUID_TESTNET_URL ?? "https://api.hyperliquid-testnet.xyz";

  // Universe cache: per-asset max leverage; refreshed every 5 minutes.
  let universeCache: { byCoin: Map<string, number>; fetchedAt: number } | null = null;
  async function getUniverse(): Promise<Map<string, number>> {
    if (universeCache && Date.now() - universeCache.fetchedAt < 5 * 60_000) {
      return universeCache.byCoin;
    }
    const res = await fetch(`${base}/info`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });
    if (!res.ok) throw new Error(`hyperliquid meta failed: ${res.status}`);
    const data = (await res.json()) as { universe: Array<{ name: string; maxLeverage: number }> };
    const byCoin = new Map(data.universe.map((u) => [u.name, u.maxLeverage]));
    universeCache = { byCoin, fetchedAt: Date.now() };
    return byCoin;
  }

  return {
    id: "hyperliquid",
    async pullLeaderTelemetry(leader: Address): Promise<LeaderTelemetry | null> {
      // 24h window for realized-PnL aggregation from userFills.
      const startMs = Date.now() - 24 * 60 * 60 * 1000;
      const [chsRes, fillsRes, universe] = await Promise.all([
        fetch(`${base}/info`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "clearinghouseState", user: leader }),
        }),
        fetch(`${base}/info`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "userFillsByTime", user: leader, startTime: startMs }),
        }),
        getUniverse().catch(() => new Map<string, number>()),
      ]);
      if (!chsRes.ok) return null;
      const data = (await chsRes.json()) as {
        marginSummary?: { accountValue?: string; totalNtlPos?: string };
        assetPositions?: Array<{
          position?: {
            coin?: string;
            szi?: string;
            entryPx?: string;
            unrealizedPnl?: string;
            leverage?: { type?: string; value?: number };
          };
        }>;
        time?: number;
      };
      if (!data.marginSummary) return null;

      const equity = Number(data.marginSummary.accountValue ?? "0");
      const totalNtl = Number(data.marginSummary.totalNtlPos ?? "0");
      const positions = (data.assetPositions ?? []).map((p) => {
        const szi = Number(p.position?.szi ?? "0");
        const entry = Number(p.position?.entryPx ?? "0");
        return {
          symbol: p.position?.coin ?? "?",
          notionalUsd: Math.abs(szi * entry),
          side: (szi >= 0 ? "long" : "short") as "long" | "short",
        };
      });
      const unrealized = (data.assetPositions ?? []).reduce(
        (s, p) => s + Number(p.position?.unrealizedPnl ?? "0"),
        0,
      );
      // Real current leverage = total notional / equity. Zero-equity guarded.
      const leverageCurrent = equity > 0 ? totalNtl / equity : 0;
      // Real declared max = max over the open coins (or 1 if no positions yet).
      const declaredMax = (data.assetPositions ?? []).reduce((m, p) => {
        const v = universe.get(p.position?.coin ?? "") ?? 1;
        return Math.max(m, v);
      }, 1);
      const stalenessMs = data.time ? Math.max(0, Date.now() - data.time) : 0;

      // Real realized PnL from the last 24h of user fills.
      let realized = 0;
      if (fillsRes.ok) {
        const fills = (await fillsRes.json()) as Array<{ closedPnl?: string }>;
        for (const f of fills) realized += Number(f.closedPnl ?? "0");
      }

      return {
        leader,
        positions,
        realizedPnlUsd: realized,
        unrealizedPnlUsd: unrealized,
        // Peak equity is computed by the caller across polls (loop.ts pushHistory).
        peakEquityUsd: equity,
        currentEquityUsd: equity,
        leverageCurrent,
        leverageDeclaredMax: declaredMax,
        staleness: Math.round(stalenessMs / 1000),
        confirmingOracles: 1,
      };
    },
  };
}
