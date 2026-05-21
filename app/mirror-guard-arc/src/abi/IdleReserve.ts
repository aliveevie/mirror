export const IdleReserveAbi = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [{ name: "usycAmount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalUsycHeld", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
