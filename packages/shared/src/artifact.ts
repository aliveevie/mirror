import { z } from "zod";
import { keccak256, toBytes, type Hex } from "viem";

/**
 * Canonical schema for a supervisor reasoning artifact.
 * The artifact is content-addressed; its hash is committed on-chain alongside
 * every allocation update and FSM evaluation.
 *
 * Mirrors §3.3 of ARCHITECTURE.md.
 */

export const Regime = z.enum(["LOW_VOL", "TRANSITION", "HIGH_VOL", "DISLOCATION"]);
export type Regime = z.infer<typeof Regime>;

export const Decision = z.enum([
  "MAINTAIN",
  "REWEIGHT",
  "WATCH",
  "ALERT",
  "SLASH",
  "ROTATE_TO_USYC",
]);
export type Decision = z.infer<typeof Decision>;

export const Features = z.object({
  drawdown_realized_bps: z.number().int(),
  drawdown_velocity_bps_per_hour: z.number().int(),
  position_concentration_hhi: z.number().int().nonnegative(),
  correlation_drift: z.number().int(),
  leverage_current: z.number().int().nonnegative(),
  leverage_declared_max: z.number().int().nonnegative(),
});
export type Features = z.infer<typeof Features>;

export const ReasoningArtifact = z.object({
  agent_version: z.string(),
  timestamp_unix: z.number().int().nonnegative(),
  leader: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  regime: Regime,
  features: Features,
  thresholds_applied: z.record(z.string(), z.number()),
  decision: Decision,
  decision_parameters: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
});
export type ReasoningArtifact = z.infer<typeof ReasoningArtifact>;

/** Canonical JSON serialization: sort keys, no whitespace. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

export function hashArtifact(artifact: ReasoningArtifact): Hex {
  const parsed = ReasoningArtifact.parse(artifact);
  return keccak256(toBytes(canonicalize(parsed)));
}
