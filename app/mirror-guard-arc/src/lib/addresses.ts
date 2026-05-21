export const ADDRESSES = {
  LeaderRegistry: "0xf1559Cea926906329a063a071c5290C4a65A2806",
  AllocationRouter: "0x95Aa364114033d1a72F15361321295c54cBacA10",
  RiskCircuitBreaker: "0x4C329C3d68ef2c9510E249A8FF991EfbDf15F1b9",
  BuilderFeeWrapper: "0xb3dD9713A8353eDA05F967a5154B8fCE6E5604C8",
  IdleReserve: "0x41fBF4092Fee25632F368c35Bb88692568090490",
  USDC: "0x3600000000000000000000000000000000000000",
  USYC: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
  AgentWallet: "0xce61a403fc0155170258225669a78c86f7b2887c",
} as const;

export type ContractName = keyof typeof ADDRESSES;

export const CONTRACT_LIST: { name: ContractName; address: string; description: string }[] = [
  {
    name: "LeaderRegistry",
    address: ADDRESSES.LeaderRegistry,
    description: "On-chain registry of leaders, bonds, and strategy commitments.",
  },
  {
    name: "AllocationRouter",
    address: ADDRESSES.AllocationRouter,
    description: "Routes follower deposits into leader mirror allocations.",
  },
  {
    name: "RiskCircuitBreaker",
    address: ADDRESSES.RiskCircuitBreaker,
    description: "5-state FSM that gates leader risk and executes slashes.",
  },
  {
    name: "BuilderFeeWrapper",
    address: ADDRESSES.BuilderFeeWrapper,
    description: "Wraps Hyperliquid builder-fee accrual for mirrored flow.",
  },
  {
    name: "IdleReserve",
    address: ADDRESSES.IdleReserve,
    description: "Idle USDC reserve used to settle slash rebates.",
  },
  { name: "USDC", address: ADDRESSES.USDC, description: "Settlement asset (6 decimals)." },
  { name: "USYC", address: ADDRESSES.USYC, description: "Yield-bearing rotation asset." },
];
