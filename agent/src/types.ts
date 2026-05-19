import type { Address, Hex } from "viem";
import type { Regime, Decision, Features } from "@mirror/shared";

export interface LeaderTelemetry {
  leader: Address;
  positions: Array<{ symbol: string; notionalUsd: number; side: "long" | "short" }>;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  peakEquityUsd: number;
  currentEquityUsd: number;
  leverageCurrent: number;
  leverageDeclaredMax: number;
  /** seconds since last fill */
  staleness: number;
  /** count of distinct oracle sources confirming the snapshot */
  confirmingOracles: number;
}

export interface MarketSnapshot {
  /** annualized realized volatility, bps */
  realizedVolBps: number;
  /** funding rate dispersion across major perps, bps */
  fundingDispersionBps: number;
  /** correlation breakdown indicator (0..100) */
  correlationStress: number;
}

export interface DecisionResult {
  decision: Decision;
  regime: Regime;
  features: Features;
  parameters: Record<string, unknown>;
  confidence: number;
  thresholds: Record<string, number>;
  artifactHash: Hex;
}
