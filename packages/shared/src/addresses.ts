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
 */
export function addressesFromEnv(env: Record<string, string | undefined> = process.env): MirrorAddresses {
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
  rpcUrl: process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
  explorer: "https://explorer.testnet.arc.network",
} as const;
