export const BuilderFeeWrapperAbi = [
  {
    type: "function",
    name: "attribute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "venueId", type: "bytes32" },
      { name: "payload", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "function", name: "accrueFromBalance", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimTreasury", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimAgentOps", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimRebate", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "accruedTreasury", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "accruedAgent", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "accruedRebate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
