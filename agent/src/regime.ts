import type { Regime } from "@mirror/shared";
import type { MarketSnapshot } from "./types.ts";

/**
 * Classify market regime from macro features.
 * Envelopes downstream — Aggressive profile in DISLOCATION is materially
 * narrower than in LOW_VOL.
 */
export function classifyRegime(m: MarketSnapshot): Regime {
  if (m.correlationStress >= 75 || m.realizedVolBps >= 8_000) return "DISLOCATION";
  if (m.realizedVolBps >= 4_500 || m.fundingDispersionBps >= 80) return "HIGH_VOL";
  if (m.realizedVolBps >= 2_500) return "TRANSITION";
  return "LOW_VOL";
}

/**
 * Regime-conditional allocation envelope (max bps per single leader).
 * Aggressive profile in low vol can concentrate; in dislocation, cap is tight.
 */
export function maxWeightPerLeader(regime: Regime, profile: "Conservative" | "Balanced" | "Aggressive"): number {
  const base = { Conservative: 1_500, Balanced: 2_500, Aggressive: 4_000 }[profile];
  const scale = { LOW_VOL: 1.0, TRANSITION: 0.85, HIGH_VOL: 0.6, DISLOCATION: 0.3 }[regime];
  return Math.round(base * scale);
}
