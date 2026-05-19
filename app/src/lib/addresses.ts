import type { MirrorAddresses } from "@mirror/shared";

const env = import.meta.env;

export const addresses: MirrorAddresses = {
  USDC: env.VITE_ADDR_USDC as `0x${string}`,
  USYC: env.VITE_ADDR_USYC as `0x${string}`,
  leaderRegistry: env.VITE_ADDR_LEADER_REGISTRY as `0x${string}`,
  allocationRouter: env.VITE_ADDR_ALLOCATION_ROUTER as `0x${string}`,
  riskCircuitBreaker: env.VITE_ADDR_RISK_CIRCUIT_BREAKER as `0x${string}`,
  builderFeeWrapper: env.VITE_ADDR_BUILDER_FEE_WRAPPER as `0x${string}`,
  idleReserve: env.VITE_ADDR_IDLE_RESERVE as `0x${string}`,
};
