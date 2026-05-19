import type { Address } from "viem";
import type { LeaderTelemetry } from "../types.ts";

/**
 * Uniform venue connector surface. Real connectors are thin adapters around
 * each venue's public API; failures degrade gracefully (a connector returning
 * null for a leader simply omits that signal from the consensus check).
 */
export interface VenueConnector {
  id: string;
  pullLeaderTelemetry(leader: Address): Promise<LeaderTelemetry | null>;
}
