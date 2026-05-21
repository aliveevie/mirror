export const AllocationRouterAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "profile", type: "uint8" },
    ],
    outputs: [],
  },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "setAllocation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "follower", type: "address" },
      {
        name: "newVector",
        type: "tuple[]",
        components: [
          { name: "leader", type: "address" },
          { name: "weightBps", type: "uint16" },
          { name: "lastUpdated", type: "uint64" },
        ],
      },
      { name: "artifactHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAllocation",
    stateMutability: "view",
    inputs: [{ name: "follower", type: "address" }],
    outputs: [{
      type: "tuple[]",
      components: [
        { name: "leader", type: "address" },
        { name: "weightBps", type: "uint16" },
        { name: "lastUpdated", type: "uint64" },
      ],
    }],
  },
  { type: "function", name: "getPrincipal", stateMutability: "view", inputs: [{ name: "follower", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getProfile", stateMutability: "view", inputs: [{ name: "follower", type: "address" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "leaderInflow", stateMutability: "view", inputs: [{ name: "leader", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "AllocationSet",
    inputs: [
      { name: "follower", type: "address", indexed: true },
      { name: "artifactHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
