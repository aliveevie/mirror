import { defineChain } from "viem";

export const ARC_TESTNET_ID = 5042002 as const;

export const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const ARC_EXPLORER = "https://testnet.arcscan.app";

export function explorerAddress(addr: string) {
  return `${ARC_EXPLORER}/address/${addr}`;
}
export function explorerTx(hash: string) {
  return `${ARC_EXPLORER}/tx/${hash}`;
}
export function explorerBlock(n: number | bigint) {
  return `${ARC_EXPLORER}/block/${n.toString()}`;
}
