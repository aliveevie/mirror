export const RiskCircuitBreakerAbi = [
  {
    type: "function",
    name: "evaluate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "leader", type: "address" },
      {
        name: "t",
        type: "tuple",
        components: [
          { name: "drawdownBps", type: "uint32" },
          { name: "drawdownVelocityBpsPerHour", type: "uint32" },
          { name: "concentrationHhi", type: "uint32" },
          { name: "correlationDriftBps", type: "uint32" },
          { name: "leverageCurrent", type: "uint32" },
          { name: "leverageDeclaredMax", type: "uint32" },
          { name: "confirmingOracles", type: "uint8" },
          { name: "artifactHash", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "executeSlash",
    stateMutability: "nonpayable",
    inputs: [
      { name: "leader", type: "address" },
      { name: "bps", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "leaderState",
    stateMutability: "view",
    inputs: [{ name: "leader", type: "address" }],
    outputs: [
      { name: "state", type: "uint8" },
      { name: "enteredAt", type: "uint64" },
      { name: "watchAccumulatedSec", type: "uint64" },
      { name: "lastArtifactHash", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "StateTransitioned",
    inputs: [
      { name: "leader", type: "address", indexed: true },
      { name: "from", type: "uint8", indexed: false },
      { name: "to", type: "uint8", indexed: false },
      { name: "artifactHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SlashExecuted",
    inputs: [
      { name: "leader", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "artifactHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
