import * as React from "react";
import { useBlockNumber, useReadContract } from "wagmi";
import { createPublicClient, http, parseAbiItem, type Address, type Hex } from "viem";
import { arcTestnet, ARC_TESTNET_ID } from "@/lib/chain";
import { ADDRESSES } from "@/lib/addresses";
import { LeaderRegistryAbi } from "@/abi";

/**
 * Single source of truth for the live supervisor data shown on the homepage.
 *
 * Reads everything from Arc testnet RPC — no mocks. Streaming for the FSM
 * transition feed; polled for snapshot stats.
 */
export interface TransitionEvent {
  txHash: Hex;
  blockNumber: bigint;
  leader: Address;
  from: number;
  to: number;
  artifactHash: Hex;
}

interface SupervisorFeed {
  blockNumber: bigint | undefined;
  transitions: TransitionEvent[];
  agentTxCount: number | null;
  agentTxLifetime: number | null;
  leaderCount: bigint | null;
  totalBondedRaw: bigint | null;
  loading: boolean;
  error: string | null;
}

const TRANSITION_EVENT = parseAbiItem(
  "event StateTransitioned(address indexed leader, uint8 from, uint8 to, bytes32 artifactHash)",
);

// Arc RPC limits getLogs to 10000 blocks per request. To cover the full
// hackathon timeline we paginate up to TOTAL_LOOKBACK blocks.
const PAGE_SIZE = 10_000n;
const TOTAL_LOOKBACK = 100_000n;

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(arcTestnet.rpcUrls.default.http[0]),
});

export function useSupervisorFeed(): SupervisorFeed {
  const { data: blockNumber } = useBlockNumber({
    chainId: ARC_TESTNET_ID,
    watch: true,
  });

  const { data: leaderCount } = useReadContract({
    address: ADDRESSES.LeaderRegistry as Address,
    abi: LeaderRegistryAbi,
    functionName: "leaderCount",
    chainId: ARC_TESTNET_ID,
    query: { refetchInterval: 10_000 },
  });

  const [transitions, setTransitions] = React.useState<TransitionEvent[]>([]);
  const [agentTxCount, setAgentTxCount] = React.useState<number | null>(null);
  const [agentTxLifetime, setAgentTxLifetime] = React.useState<number | null>(null);
  const [totalBondedRaw, setTotalBondedRaw] = React.useState<bigint | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const head = await client.getBlockNumber();
        if (cancelled) return;

        // FSM transitions across TOTAL_LOOKBACK blocks, in PAGE_SIZE-sized
        // chunks to respect the Arc RPC's 10k-range limit.
        const earliest = head > TOTAL_LOOKBACK ? head - TOTAL_LOOKBACK : 0n;
        type Decoded = TransitionEvent;
        const allEvents: Decoded[] = [];
        let cursor = head;
        while (cursor > earliest && !cancelled) {
          const fromBlock = cursor > PAGE_SIZE ? cursor - PAGE_SIZE : 0n;
          try {
            const chunk = await client.getLogs({
              address: ADDRESSES.RiskCircuitBreaker as Address,
              event: TRANSITION_EVENT,
              fromBlock,
              toBlock: cursor,
            });
            for (const l of chunk) {
              allEvents.push({
                txHash: l.transactionHash!,
                blockNumber: l.blockNumber!,
                leader: l.args.leader as Address,
                from: Number(l.args.from ?? 0),
                to: Number(l.args.to ?? 0),
                artifactHash: l.args.artifactHash as Hex,
              });
            }
          } catch {
            // tolerate transient RPC errors per page
          }
          cursor = fromBlock === 0n ? 0n : fromBlock - 1n;
          if (allEvents.length >= 50) break;
        }
        if (cancelled) return;

        const evts: TransitionEvent[] = allEvents
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, 10);
        setTransitions(evts);

        // Agent wallet tx count: lifetime nonce + delta over the lookback window.
        const nowNonce = await client.getTransactionCount({
          address: ADDRESSES.AgentWallet as Address,
          blockNumber: head,
        });
        const windowStart = head > TOTAL_LOOKBACK ? head - TOTAL_LOOKBACK : 0n;
        const thenNonce = await client.getTransactionCount({
          address: ADDRESSES.AgentWallet as Address,
          blockNumber: windowStart,
        });
        if (!cancelled) {
          setAgentTxCount(nowNonce - thenNonce);
          setAgentTxLifetime(nowNonce);
        }

        // Total bonded across all leaders (iterate getBondStatus).
        if (leaderCount && (leaderCount as bigint) > 0n) {
          const lc = Number(leaderCount as bigint);
          const leaders: Address[] = [];
          for (let i = 0; i < lc; i++) {
            const addr = (await client.readContract({
              address: ADDRESSES.LeaderRegistry as Address,
              abi: LeaderRegistryAbi,
              functionName: "leaders",
              args: [BigInt(i)],
            })) as Address;
            leaders.push(addr);
          }
          let total = 0n;
          for (const l of leaders) {
            const status = (await client.readContract({
              address: ADDRESSES.LeaderRegistry as Address,
              abi: LeaderRegistryAbi,
              functionName: "getBondStatus",
              args: [l],
            })) as [boolean, bigint, bigint, bigint];
            total += status[1] + status[2];
          }
          if (!cancelled) setTotalBondedRaw(total);
        } else if (!cancelled) {
          setTotalBondedRaw(0n);
        }

        if (!cancelled) {
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(String((e as { shortMessage?: string }).shortMessage ?? e));
          setLoading(false);
        }
      }
    }

    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [leaderCount]);

  return {
    blockNumber,
    transitions,
    agentTxCount,
    agentTxLifetime,
    leaderCount: (leaderCount as bigint | undefined) ?? null,
    totalBondedRaw,
    loading,
    error,
  };
}
