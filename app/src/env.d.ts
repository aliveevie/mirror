/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARC_RPC_URL?: string;
  readonly VITE_ARC_CHAIN_ID?: string;
  readonly VITE_ADDR_USDC: string;
  readonly VITE_ADDR_USYC: string;
  readonly VITE_ADDR_LEADER_REGISTRY: string;
  readonly VITE_ADDR_ALLOCATION_ROUTER: string;
  readonly VITE_ADDR_RISK_CIRCUIT_BREAKER: string;
  readonly VITE_ADDR_BUILDER_FEE_WRAPPER: string;
  readonly VITE_ADDR_IDLE_RESERVE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
