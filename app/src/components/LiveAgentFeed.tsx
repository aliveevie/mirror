import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem, type Hex } from "viem";
import { arcTestnet } from "../lib/chain";
import { addresses } from "../lib/addresses";
import { shorten } from "../lib/format";

/**
 * Live agent activity panel. Polls the RiskCircuitBreaker for recent
 * StateTransitioned events and the supervisor wallet for recent txs, so
 * a judge sees the AI agent's on-chain footprint immediately on landing.
 *
 * No mocks — direct read against Arc testnet via viem.
 */
const RANGE_BLOCKS = 5000n;

interface Activity {
  kind: "transition" | "tx";
  hash: Hex;
  blockNumber: bigint;
  leader?: `0x${string}`;
  from?: State;
  to?: State;
}

type State = "NORMAL" | "WATCH" | "ALERT" | "SLASHING" | "COOLDOWN";
const STATE_NAMES: State[] = ["NORMAL", "WATCH", "ALERT", "SLASHING", "COOLDOWN"];

const transitionEvent = parseAbiItem(
  "event StateTransitioned(address indexed leader, uint8 from, uint8 to, bytes32 artifactHash)",
);

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(arcTestnet.rpcUrls.default.http[0]),
});

const AGENT_WALLET = "0xce61a403fc0155170258225669a78c86f7b2887c" as const;

export function LiveAgentFeed() {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [latestBlock, setLatestBlock] = useState<bigint | null>(null);
  const [agentTxCount24h, setAgentTxCount24h] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const head = await client.getBlockNumber();
        if (cancelled) return;
        setLatestBlock(head);

        // 1) Fetch state-transition events from the breaker (the FSM moves we care about).
        const fromBlock = head > RANGE_BLOCKS ? head - RANGE_BLOCKS : 0n;
        const logs = await client.getLogs({
          address: addresses.riskCircuitBreaker,
          event: transitionEvent,
          fromBlock,
          toBlock: head,
        });

        const transitions: Activity[] = logs.slice(-10).reverse().map((l) => ({
          kind: "transition" as const,
          hash: l.transactionHash!,
          blockNumber: l.blockNumber!,
          leader: l.args.leader as `0x${string}` | undefined,
          from: STATE_NAMES[Number(l.args.from ?? 0)] ?? "NORMAL",
          to: STATE_NAMES[Number(l.args.to ?? 0)] ?? "NORMAL",
        }));

        setActivity(transitions);

        // 2) Count recent agent-wallet txs (rough proxy for "is the supervisor alive").
        // We approximate by checking nonce delta in the last 24h's ~worth of blocks.
        // Arc ~1 block/sec; 24h ≈ 86400 blocks. Cap to RANGE_BLOCKS for the demo.
        const nonceNow = await client.getTransactionCount({ address: AGENT_WALLET, blockNumber: head });
        const nonceThen = await client.getTransactionCount({
          address: AGENT_WALLET,
          blockNumber: head > RANGE_BLOCKS ? head - RANGE_BLOCKS : 0n,
        });
        if (!cancelled) setAgentTxCount24h(nonceNow - nonceThen);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String((e as { shortMessage?: string }).shortMessage ?? e));
      }
    }
    poll();
    const id = setInterval(poll, 8_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="panel">
      <h2>Live Supervisor Activity</h2>
      <div className="kv">
        <span>Agent wallet (Circle)</span>
        <a
          className="mono"
          target="_blank"
          rel="noreferrer"
          href={`${arcTestnet.blockExplorers.default.url}/address/${AGENT_WALLET}`}
        >
          {shorten(AGENT_WALLET)} ↗
        </a>
      </div>
      <div className="kv">
        <span>Arc block (latest)</span>
        <span className="mono">{latestBlock?.toString() ?? "…"}</span>
      </div>
      <div className="kv">
        <span>Agent txs (recent window)</span>
        <span className="mono">{agentTxCount24h ?? "…"}</span>
      </div>
      <div className="kv">
        <span>Breaker contract</span>
        <a
          className="mono"
          target="_blank"
          rel="noreferrer"
          href={`${arcTestnet.blockExplorers.default.url}/address/${addresses.riskCircuitBreaker}`}
        >
          {shorten(addresses.riskCircuitBreaker)} ↗
        </a>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Recent FSM transitions
        </div>
        {activity.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            No transitions in the last {RANGE_BLOCKS.toString()} blocks. The supervisor is evaluating every 15s; transitions only occur when drawdown crosses thresholds.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {activity.map((a) => (
              <li key={a.hash} className="kv">
                <span className="mono">
                  {a.leader && shorten(a.leader)} · {a.from} → {a.to}
                </span>
                <a
                  className="mono"
                  target="_blank"
                  rel="noreferrer"
                  href={`${arcTestnet.blockExplorers.default.url}/tx/${a.hash}`}
                >
                  block {a.blockNumber.toString()} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 12 }}>RPC error: {error}</p>
      )}
    </div>
  );
}
