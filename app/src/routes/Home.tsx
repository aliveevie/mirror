import { ConnectButton } from "../components/ConnectButton";
import { LiveAgentFeed } from "../components/LiveAgentFeed";
import { addresses } from "../lib/addresses";
import { arcTestnet } from "../lib/chain";
import { shorten } from "../lib/format";

export default function Home() {
  return (
    <>
      <div className="panel">
        <h2>Mirror Protocol</h2>
        <p style={{ fontSize: 18, lineHeight: 1.5, margin: "8px 0 16px" }}>
          Slash-bonded social trading with an autonomous AI risk supervisor.
        </p>
        <p className="muted" style={{ marginBottom: 20 }}>
          Hyperliquid leaders post USDC bonds on Arc. Followers mirror their trades. A Circle-signed
          AI agent watches each leader 24/7 — when risk crosses thresholds, the bond slashes in
          sub-second finality and pays followers a rebate.
        </p>
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          <ConnectButton />
          <span className="muted" style={{ fontSize: 13 }}>
            Chain {arcTestnet.id} · {arcTestnet.name}
          </span>
        </div>
      </div>

      <LiveAgentFeed />

      <div className="grid">
        <div className="panel">
          <h2>For Leaders</h2>
          <p>Post a USDC bond, declare your strategy, and earn fee attribution on follower flow. Your bond gets slashed if the supervisor sees your risk profile blow up.</p>
          <a href="/leader" style={{ fontWeight: 600 }}>Open leader app →</a>
        </div>
        <div className="panel">
          <h2>For Followers</h2>
          <p>Deposit USDC, pick a leader to mirror, and let the supervisor route allocations. If the leader gets slashed, you get a rebate from their bond.</p>
          <a href="/follower" style={{ fontWeight: 600 }}>Open follower app →</a>
        </div>
      </div>

      <div className="panel">
        <h2>Deployed Contracts · Arc Testnet</h2>
        {(
          [
            ["LeaderRegistry", addresses.leaderRegistry],
            ["AllocationRouter", addresses.allocationRouter],
            ["RiskCircuitBreaker", addresses.riskCircuitBreaker],
            ["BuilderFeeWrapper", addresses.builderFeeWrapper],
            ["IdleReserve", addresses.idleReserve],
            ["USDC", addresses.USDC],
            ["USYC", addresses.USYC],
          ] as const
        ).map(([name, addr]) => (
          <div className="kv" key={addr}>
            <span>{name}</span>
            <a
              className="mono"
              target="_blank"
              rel="noreferrer"
              href={`${arcTestnet.blockExplorers.default.url}/address/${addr}`}
            >
              {shorten(addr)} ↗
            </a>
          </div>
        ))}
      </div>
    </>
  );
}
