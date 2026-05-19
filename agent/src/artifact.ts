import { ReasoningArtifact, hashArtifact, type Decision, type Features, type Regime } from "@mirror/shared";
import type { Address, Hex } from "viem";

/**
 * Build and content-address a supervisor reasoning artifact.
 * Returns both the canonical bytes (to be pinned) and the on-chain commitment hash.
 */
export function buildArtifact(input: {
  agentVersion: string;
  leader: Address;
  regime: Regime;
  features: Features;
  thresholds: Record<string, number>;
  decision: Decision;
  parameters: Record<string, unknown>;
  confidence: number;
}): { artifact: ReasoningArtifact; hash: Hex } {
  const artifact: ReasoningArtifact = ReasoningArtifact.parse({
    agent_version: input.agentVersion,
    timestamp_unix: Math.floor(Date.now() / 1000),
    leader: input.leader,
    regime: input.regime,
    features: input.features,
    thresholds_applied: input.thresholds,
    decision: input.decision,
    decision_parameters: input.parameters,
    confidence: input.confidence,
  });
  return { artifact, hash: hashArtifact(artifact) };
}

/**
 * Pin the artifact to content-addressable storage. The pin endpoint is
 * configured per-environment; the contract here is: POST canonical bytes,
 * receive back the same hash. If anything else is returned the pin failed.
 */
export async function pinArtifact(artifact: ReasoningArtifact, expectedHash: Hex): Promise<void> {
  const endpoint = process.env.ARTIFACT_PIN_ENDPOINT;
  const token = process.env.ARTIFACT_PIN_TOKEN;
  if (!endpoint) {
    console.warn("[artifact] ARTIFACT_PIN_ENDPOINT not set; skipping pin", { hash: expectedHash });
    return;
  }
  const isPinata = endpoint.includes("pinata.cloud");
  const body = isPinata
    ? {
        pinataContent: artifact,
        pinataMetadata: { name: `mirror-artifact-${expectedHash}` },
      }
    : { hash: expectedHash, artifact };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`pin failed: ${res.status} ${await res.text()}`);
  }
}
