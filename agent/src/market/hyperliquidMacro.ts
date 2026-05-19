import type { MarketSnapshot } from "../types.ts";

/**
 * Aggregate per-asset live data from Hyperliquid's `metaAndAssetCtxs` into a
 * macro market snapshot. All metrics are derived from real on-venue numbers:
 *   - realizedVolBps     : stddev (bps) of 1-day return `(markPx - prevDayPx)/prevDayPx`
 *                          across the perp universe.
 *   - fundingDispersionBps: stddev (bps) of the `funding` field across the universe.
 *   - correlationStress  : mean absolute deviation (bps) of 1-day returns around
 *                          the universe median — proxy for cross-asset dispersion
 *                          (high = decorrelated; low = correlated stress).
 */
export async function hyperliquidMarketSnapshot(): Promise<MarketSnapshot> {
  const base = process.env.HYPERLIQUID_TESTNET_URL ?? "https://api.hyperliquid-testnet.xyz";
  const res = await fetch(`${base}/info`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });
  if (!res.ok) throw new Error(`hyperliquid metaAndAssetCtxs failed: ${res.status}`);
  const data = (await res.json()) as [
    { universe: Array<{ name: string }> },
    Array<{ funding?: string; prevDayPx?: string; markPx?: string }>,
  ];

  const ctx = data[1] ?? [];
  const returns: number[] = [];
  const fundings: number[] = [];
  for (const c of ctx) {
    const mark = Number(c.markPx);
    const prev = Number(c.prevDayPx);
    const f = Number(c.funding);
    if (Number.isFinite(mark) && Number.isFinite(prev) && prev > 0) {
      returns.push((mark - prev) / prev);
    }
    if (Number.isFinite(f)) fundings.push(f);
  }
  if (returns.length === 0 || fundings.length === 0) {
    throw new Error("hyperliquid macro snapshot empty — venue may be degraded");
  }

  const realizedVolBps = Math.round(stddev(returns) * 10_000);
  const fundingDispersionBps = Math.round(stddev(fundings) * 10_000);
  const median = quantile(returns, 0.5);
  const mad = returns.reduce((s, r) => s + Math.abs(r - median), 0) / returns.length;
  const correlationStress = Math.round(mad * 10_000);

  return { realizedVolBps, fundingDispersionBps, correlationStress };
}

function stddev(xs: number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

function quantile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)));
  return sorted[idx];
}
