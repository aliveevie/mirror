import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { shorten } from "../lib/format";
import { arcTestnet } from "../lib/chain";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, status } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(connectorId?: string) {
    setError(null);
    const c = connectorId ? connectors.find((x) => x.id === connectorId) : connectors[0];
    if (!c) {
      setError("No wallet detected. Install MetaMask or any EIP-1193 wallet and refresh.");
      return;
    }
    try {
      await connectAsync({ connector: c, chainId: arcTestnet.id });
      // After connect, force-switch to Arc Testnet if the wallet is on another chain.
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
      } catch (switchErr: unknown) {
        const msg = (switchErr as { message?: string })?.message ?? String(switchErr);
        if (!/already on/i.test(msg)) {
          setError(`Connected, but couldn't switch to Arc Testnet: ${msg}. Add it manually in your wallet (chain id ${arcTestnet.id}, RPC ${arcTestnet.rpcUrls.default.http[0]}).`);
        }
      }
    } catch (e: unknown) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage
        ?? (e as { message?: string })?.message
        ?? String(e);
      setError(msg);
    }
  }

  if (isConnected) {
    const onCorrectChain = currentChainId === arcTestnet.id;
    return (
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <span className="mono" title={address}>{shorten(address)}</span>
        {onCorrectChain ? (
          <span className="badge normal">Arc Testnet</span>
        ) : (
          <button onClick={() => switchChainAsync({ chainId: arcTestnet.id }).catch((e) => setError(String(e)))}>
            Switch to Arc Testnet
          </button>
        )}
        <button onClick={() => disconnect()}>Disconnect</button>
        {error && <span style={{ color: "var(--bad)", fontSize: 12 }}>{error}</span>}
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <button disabled>No wallet detected</button>
        <span className="muted" style={{ fontSize: 12 }}>
          Install <a href="https://metamask.io/download" target="_blank" rel="noreferrer">MetaMask</a> and refresh.
        </span>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {connectors.map((c) => (
        <button
          key={c.id}
          disabled={status === "pending"}
          onClick={() => handleConnect(c.id)}
        >
          {status === "pending" ? "Connecting…" : `Connect ${c.name}`}
        </button>
      ))}
      {error && <span style={{ color: "var(--bad)", fontSize: 12, marginLeft: 4 }}>{error}</span>}
    </div>
  );
}
