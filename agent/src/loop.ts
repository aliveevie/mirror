import { encodeFunctionData, type Address } from "viem";
import { abis, addressesFromEnv, type MirrorAddresses } from "@mirror/shared";

import { classifyRegime } from "./regime.ts";
import { computeFeatures } from "./features.ts";
import { decide } from "./policy.ts";
import { buildArtifact, pinArtifact } from "./artifact.ts";
import type { AgentWallet } from "./wallet.ts";
import type { LeaderTelemetry, MarketSnapshot } from "./types.ts";
import type { VenueConnector } from "./venues/types.ts";

const AGENT_VERSION = "mirror-supervisor/0.1.0";

interface LeaderHistory { ts: number; equity: number }
const history = new Map<Address, LeaderHistory[]>();

function pushHistory(leader: Address, equity: number) {
  const arr = history.get(leader) ?? [];
  arr.push({ ts: Math.floor(Date.now() / 1000), equity });
  // keep last 24h at 1-minute resolution
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 3600;
  while (arr.length && arr[0].ts < cutoff) arr.shift();
  history.set(leader, arr);
}

/**
 * Collect telemetry from all connectors. Returns a consensus snapshot with the
 * count of confirming oracles — single-oracle inputs cannot trip ALERT→SLASHING
 * (the contract requires confirmingOracles ≥ 2).
 */
async function collectTelemetry(
  leader: Address,
  connectors: VenueConnector[],
): Promise<LeaderTelemetry | null> {
  const results = await Promise.all(connectors.map((c) => c.pullLeaderTelemetry(leader)));
  const ok = results.filter((r): r is LeaderTelemetry => r !== null);
  if (ok.length === 0) return null;

  // Aggregate across venues: mean equity, max leverage, max declared, sum of pnl,
  // min staleness, union of positions. confirmingOracles is the count of venues
  // that returned data (the breaker's quorum gate reads this directly).
  const equity = ok.reduce((s, r) => s + r.currentEquityUsd, 0) / ok.length;
  const peak = Math.max(...ok.map((r) => r.peakEquityUsd));
  const leverage = Math.max(...ok.map((r) => r.leverageCurrent));
  const declaredMax = Math.max(...ok.map((r) => r.leverageDeclaredMax));
  return {
    leader,
    positions: ok.flatMap((r) => r.positions),
    realizedPnlUsd: ok.reduce((s, r) => s + r.realizedPnlUsd, 0),
    unrealizedPnlUsd: ok.reduce((s, r) => s + r.unrealizedPnlUsd, 0),
    peakEquityUsd: peak,
    currentEquityUsd: equity,
    leverageCurrent: leverage,
    leverageDeclaredMax: declaredMax,
    staleness: Math.min(...ok.map((r) => r.staleness)),
    confirmingOracles: ok.length,
  };
}

/** Build evaluate(...) call data for RiskCircuitBreaker. */
function encodeEvaluate(leader: Address, t: LeaderTelemetry, artifactHash: `0x${string}`, features: ReturnType<typeof computeFeatures>) {
  return encodeFunctionData({
    abi: abis.RiskCircuitBreakerAbi,
    functionName: "evaluate",
    args: [
      leader,
      {
        drawdownBps: features.drawdown_realized_bps,
        drawdownVelocityBpsPerHour: features.drawdown_velocity_bps_per_hour,
        concentrationHhi: features.position_concentration_hhi,
        correlationDriftBps: features.correlation_drift,
        leverageCurrent: features.leverage_current,
        leverageDeclaredMax: features.leverage_declared_max,
        confirmingOracles: t.confirmingOracles,
        artifactHash,
      },
    ],
  });
}

function encodeExecuteSlash(leader: Address, bps: bigint) {
  return encodeFunctionData({
    abi: abis.RiskCircuitBreakerAbi,
    functionName: "executeSlash",
    args: [leader, bps],
  });
}

export interface SupervisorDeps {
  wallet: AgentWallet;
  addresses: MirrorAddresses;
  leaders: Address[];
  connectors: VenueConnector[];
  market: () => Promise<MarketSnapshot>;
  intervalMs?: number;
}

export async function runSupervisor(deps: SupervisorDeps): Promise<void> {
  const interval = deps.intervalMs ?? 30_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Every iteration is wrapped — a transient HL timeout, RPC blip, or
    // Circle hiccup must never kill the long-running supervisor.
    try {
      const tickStart = Date.now();
      let market;
      try {
        market = await deps.market();
      } catch (e) {
        console.warn("[market snapshot failed; using neutral defaults]", String(e));
        market = { realizedVolBps: 0, fundingDispersionBps: 0, correlationStress: 0 };
      }
      const regime = classifyRegime(market);

      for (const leader of deps.leaders) {
        try {
          const t = await collectTelemetry(leader, deps.connectors);
          if (!t) continue;

          pushHistory(leader, t.currentEquityUsd);
          const hist = history.get(leader) ?? [];
          const realPeak = hist.reduce((m, h) => Math.max(m, h.equity), t.currentEquityUsd);
          const tWithPeak = { ...t, peakEquityUsd: realPeak };
          const features = computeFeatures(tWithPeak, hist);
          const result = decide(features, regime);
          const { artifact, hash } = buildArtifact({
            agentVersion: AGENT_VERSION,
            leader,
            regime,
            features,
            thresholds: result.thresholds as unknown as Record<string, number>,
            decision: result.decision,
            parameters: result.parameters,
            confidence: result.confidence,
          });

          try { await pinArtifact(artifact, hash); } catch (e) { console.error("[pin]", e); }

          const evalCall = { to: deps.addresses.riskCircuitBreaker, data: encodeEvaluate(leader, tWithPeak, hash, features) };
          try {
            const tx = await deps.wallet.signAndSend(evalCall);
            console.log("[evaluate]", { leader, decision: result.decision, tx });
          } catch (e) {
            console.error("[evaluate failed]", { leader, err: String(e) });
            continue;
          }

          if (result.decision === "SLASH") {
            const bps = BigInt(result.parameters.bps as number);
            try {
              const tx = await deps.wallet.signAndSend({
                to: deps.addresses.riskCircuitBreaker,
                data: encodeExecuteSlash(leader, bps),
              });
              console.log("[slash]", { leader, bps: bps.toString(), tx });
            } catch (e) {
              // Expected when FSM hasn't yet reached SLASHING; loop on.
              console.warn("[slash skipped]", { leader, err: String(e) });
            }
          }
        } catch (perLeaderErr) {
          console.error("[leader iter failed]", { leader, err: String(perLeaderErr) });
        }
      }

      const elapsed = Date.now() - tickStart;
      await new Promise((r) => setTimeout(r, Math.max(0, interval - elapsed)));
    } catch (tickErr) {
      console.error("[tick failed; sleeping then retrying]", String(tickErr));
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}
