import type { Decision, Features, Regime } from "@mirror/shared";

/**
 * Decision policy: map (features × regime) onto a structured decision.
 * Thresholds are regime-conditional, recorded in the artifact for audit.
 *
 * This is intentionally simple and deterministic in this scaffold. Production
 * substitutes a learned model whose weights are updated from observed outcomes
 * (slashed bonds are a training signal).
 */

export interface Thresholds {
  watchEnterDd: number;
  alertEnterDd: number;
  slashVelocity: number;
  leverageTolerance: number;
}

export function thresholdsFor(regime: Regime): Thresholds {
  switch (regime) {
    case "LOW_VOL":     return { watchEnterDd: 400, alertEnterDd: 1_000, slashVelocity: 250, leverageTolerance: 0 };
    case "TRANSITION":  return { watchEnterDd: 350, alertEnterDd: 900,   slashVelocity: 220, leverageTolerance: 0 };
    case "HIGH_VOL":    return { watchEnterDd: 300, alertEnterDd: 800,   slashVelocity: 200, leverageTolerance: 0 };
    case "DISLOCATION": return { watchEnterDd: 200, alertEnterDd: 600,   slashVelocity: 150, leverageTolerance: 0 };
  }
}

export function decide(
  features: Features,
  regime: Regime,
): { decision: Decision; parameters: Record<string, unknown>; confidence: number; thresholds: Thresholds } {
  const th = thresholdsFor(regime);

  // Hard fault paths.
  if (features.leverage_current > features.leverage_declared_max + th.leverageTolerance) {
    return {
      decision: "SLASH",
      parameters: { bps: 2_500 },
      confidence: 0.95,
      thresholds: th,
    };
  }

  if (features.drawdown_velocity_bps_per_hour >= th.slashVelocity && features.drawdown_realized_bps >= th.alertEnterDd) {
    return { decision: "SLASH", parameters: { bps: 1_500 }, confidence: 0.85, thresholds: th };
  }

  if (features.drawdown_realized_bps >= th.alertEnterDd) {
    return { decision: "ALERT", parameters: {}, confidence: 0.8, thresholds: th };
  }
  if (features.drawdown_realized_bps >= th.watchEnterDd) {
    return { decision: "WATCH", parameters: {}, confidence: 0.7, thresholds: th };
  }

  // Regime-off ramp.
  if (regime === "DISLOCATION") {
    return { decision: "ROTATE_TO_USYC", parameters: { fractionBps: 7_000 }, confidence: 0.75, thresholds: th };
  }

  return { decision: "MAINTAIN", parameters: {}, confidence: 0.6, thresholds: th };
}
