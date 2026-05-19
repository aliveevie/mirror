import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shorten } from "../lib/format";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="row">
        <span className="mono">{shorten(address)}</span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }
  const injected = connectors[0];
  return (
    <button disabled={status === "pending" || !injected} onClick={() => injected && connect({ connector: injected })}>
      {status === "pending" ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
