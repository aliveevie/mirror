import { http, createConfig } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { arcTestnet } from "./chain";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  ssr: true,
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "Mirror Protocol" }),
  ],
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
