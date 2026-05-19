import { http, createConfig, injected } from "wagmi";
import { arcTestnet } from "./chain";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: { [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]) },
});
