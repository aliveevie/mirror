export const LeaderRegistryAbi = [
  {
    type: "function",
    name: "postBond",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "strategyCommitment", type: "bytes32" },
    ],
    outputs: [],
  },
  { type: "function", name: "topUpBond", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "scheduleWithdraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawBond", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "getBondStatus",
    stateMutability: "view",
    inputs: [{ name: "leader", type: "address" }],
    outputs: [
      { name: "bonded", type: "bool" },
      { name: "available", type: "uint256" },
      { name: "locked", type: "uint256" },
      { name: "slashed", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "strategyCommitmentOf",
    stateMutability: "view",
    inputs: [{ name: "leader", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  { type: "function", name: "leaderCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "leaders", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ type: "address" }] },
  {
    type: "event",
    name: "BondPosted",
    inputs: [
      { name: "leader", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "strategyCommitment", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BondSlashed",
    inputs: [
      { name: "leader", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
