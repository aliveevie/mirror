import type { Address } from "viem";

export interface MirrorAddresses {
  USDC: Address;
  USYC: Address;
  leaderRegistry: Address;
  allocationRouter: Address;
  riskCircuitBreaker: Address;
  builderFeeWrapper: Address;
  idleReserve: Address;
}

/**
 * Resolve addresses from environment. Throws if a required address is missing,
 * so misconfigurations fail fast rather than silently routing to address(0).
 *
 * The default arg lazily reads `process.env` (Node only). In the browser, the
 * caller must pass an explicit env object (e.g. import.meta.env). The Node-only
 * default is wrapped so importing this module from a browser doesn't blow up
 * on `process is not defined` at module-eval time.
 */
function nodeEnv(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? (process.env as Record<string, string | undefined>) : {};
}

export function addressesFromEnv(env: Record<string, string | undefined> = nodeEnv()): MirrorAddresses {
  const req = (key: string): Address => {
    const v = env[key];
    if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) {
      throw new Error(`Missing or invalid env address: ${key}`);
    }
    return v as Address;
  };
  return {
    USDC: req("ADDR_USDC"),
    USYC: req("ADDR_USYC"),
    leaderRegistry: req("ADDR_LEADER_REGISTRY"),
    allocationRouter: req("ADDR_ALLOCATION_ROUTER"),
    riskCircuitBreaker: req("ADDR_RISK_CIRCUIT_BREAKER"),
    builderFeeWrapper: req("ADDR_BUILDER_FEE_WRAPPER"),
    idleReserve: req("ADDR_IDLE_RESERVE"),
  };
}

export const ARC_TESTNET = {
  chainId: 5042002,
  rpcUrl: nodeEnv().ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
  explorer: "https://explorer.testnet.arc.network",
} as const;
