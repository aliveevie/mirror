import * as React from "react";

/**
 * Pull live Hyperliquid testnet telemetry for a leader address.
 * Mirrors the agent's HL connector (no fake data).
 */
const HL_API = "https://api.hyperliquid-testnet.xyz";

export interface HLTelemetry {
  address: string;
  equity: number;
  totalNtl: number;
  leverageCurrent: number;
  unrealized: number;
  positions: { coin: string; szi: number; entryPx: number; unrealizedPnl: number; leverage: number }[];
  spotUsdc: number;
  fetchedAt: number;
}

export function useHLTelemetry(address: string | null | undefined, refreshMs = 8_000) {
  const [telemetry, setTelemetry] = React.useState<HLTelemetry | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function poll() {
      try {
        setLoading(true);
        const [stateRes, spotRes] = await Promise.all([
          fetch(`${HL_API}/info`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "clearinghouseState", user: address }),
          }),
          fetch(`${HL_API}/info`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "spotClearinghouseState", user: address }),
          }),
        ]);

        if (cancelled) return;
        if (!stateRes.ok) throw new Error(`HL clearinghouse ${stateRes.status}`);
        const state = await stateRes.json();
        const spot = spotRes.ok ? await spotRes.json() : { balances: [] };

        const equity = Number(state.marginSummary?.accountValue ?? "0");
        const totalNtl = Number(state.marginSummary?.totalNtlPos ?? "0");
        const positions = (state.assetPositions ?? []).map((p: { position: { coin?: string; szi?: string; entryPx?: string; unrealizedPnl?: string; leverage?: { value?: number } } }) => ({
          coin: p.position?.coin ?? "?",
          szi: Number(p.position?.szi ?? "0"),
          entryPx: Number(p.position?.entryPx ?? "0"),
          unrealizedPnl: Number(p.position?.unrealizedPnl ?? "0"),
          leverage: Number(p.position?.leverage?.value ?? 1),
        }));
        const unrealized = positions.reduce((s: number, p: { unrealizedPnl: number }) => s + p.unrealizedPnl, 0);
        const usdcBalance = spot.balances?.find?.((b: { coin: string; total: string }) => b.coin === "USDC");
        if (!cancelled) {
          setTelemetry({
            address: address as string,
            equity,
            totalNtl,
            leverageCurrent: equity > 0 ? totalNtl / equity : 0,
            unrealized,
            positions,
            spotUsdc: Number(usdcBalance?.total ?? "0"),
            fetchedAt: Date.now(),
          });
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    }

    poll();
    const id = setInterval(poll, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, refreshMs]);

  return { telemetry, loading, error };
}
