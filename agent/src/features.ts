import type { Features } from "@mirror/shared";
import type { LeaderTelemetry } from "./types.ts";

/**
 * Compute the fixed feature vector for a leader.
 * All quantities normalized to bps where applicable (1 bps = 0.01%).
 */
export function computeFeatures(t: LeaderTelemetry, history: Array<{ ts: number; equity: number }>): Features {
  const drawdownBps = Math.max(
    0,
    Math.round(((t.peakEquityUsd - t.currentEquityUsd) / Math.max(1, t.peakEquityUsd)) * 10_000),
  );

  // Velocity: change in drawdown per hour, using the last hour's history slice.
  const oneHourAgo = Date.now() / 1000 - 3600;
  const past = [...history].reverse().find((h) => h.ts <= oneHourAgo);
  let velocity = 0;
  if (past) {
    const pastDdBps = Math.max(
      0,
      Math.round(((t.peakEquityUsd - past.equity) / Math.max(1, t.peakEquityUsd)) * 10_000),
    );
    // Velocity is a *risk* signal — negative velocity (drawdown recovering)
    // is not interesting and the on-chain Telemetry struct holds uint32,
    // so clamp to ≥0 to avoid encodeFunctionData overflow.
    velocity = Math.max(0, drawdownBps - pastDdBps);
  }

  // Concentration: Herfindahl across symbols, normalized to 0..10_000.
  const totalNotional = t.positions.reduce((s, p) => s + Math.abs(p.notionalUsd), 0) || 1;
  const hhi = Math.round(
    t.positions.reduce((acc, p) => {
      const share = Math.abs(p.notionalUsd) / totalNotional;
      return acc + share * share;
    }, 0) * 10_000,
  );

  // Drift signal: stddev of consecutive 1-step equity log-returns over the
  // history window, expressed in bps. Real signal from real data — captures
  // how erratically the leader's equity is moving relative to its own baseline.
  // (When the architecture's declared-strategy embedding is wired up, this
  // becomes the cosine drift between observed returns and the embedding.)
  let correlationDrift = 0;
  if (history.length >= 3) {
    const rets: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const a = history[i - 1].equity;
      const b = history[i].equity;
      if (a > 0 && b > 0) rets.push(Math.log(b / a));
    }
    if (rets.length >= 2) {
      const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
      const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
      correlationDrift = Math.round(Math.sqrt(variance) * 10_000);
    }
  }

  return {
    drawdown_realized_bps: drawdownBps,
    drawdown_velocity_bps_per_hour: velocity,
    position_concentration_hhi: hhi,
    correlation_drift: correlationDrift,
    leverage_current: Math.round(t.leverageCurrent),
    leverage_declared_max: Math.round(t.leverageDeclaredMax),
  };
}
