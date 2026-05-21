import * as React from "react";
import { createPublicClient, http, type Address } from "viem";
import { arcTestnet } from "@/lib/chain";
import { ADDRESSES } from "@/lib/addresses";
import { LeaderRegistryAbi, RiskCircuitBreakerAbi } from "@/abi";
import type { LeaderRow } from "@/components/web3/LeaderTable";
import type { CircuitState } from "@/components/web3/CircuitBadge";

const STATE_NAMES: CircuitState[] = ["NORMAL", "WATCH", "ALERT", "SLASHING", "COOLDOWN"];

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(arcTestnet.rpcUrls.default.http[0]),
});

export function useLeaders(): { rows: LeaderRow[]; loading: boolean; error: string | null } {
  const [rows, setRows] = React.useState<LeaderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchLeaders() {
      try {
        const lc = (await client.readContract({
          address: ADDRESSES.LeaderRegistry as Address,
          abi: LeaderRegistryAbi,
          functionName: "leaderCount",
        })) as bigint;

        if (cancelled) return;
        const count = Number(lc);
        if (count === 0) {
          setRows([]);
          setLoading(false);
          setError(null);
          return;
        }

        const addresses: Address[] = [];
        for (let i = 0; i < count; i++) {
          const addr = (await client.readContract({
            address: ADDRESSES.LeaderRegistry as Address,
            abi: LeaderRegistryAbi,
            functionName: "leaders",
            args: [BigInt(i)],
          })) as Address;
          addresses.push(addr);
        }

        const newRows: LeaderRow[] = [];
        for (const addr of addresses) {
          const [status, strategy, fsm] = await Promise.all([
            client.readContract({
              address: ADDRESSES.LeaderRegistry as Address,
              abi: LeaderRegistryAbi,
              functionName: "getBondStatus",
              args: [addr],
            }) as Promise<[boolean, bigint, bigint, bigint]>,
            client.readContract({
              address: ADDRESSES.LeaderRegistry as Address,
              abi: LeaderRegistryAbi,
              functionName: "strategyCommitmentOf",
              args: [addr],
            }) as Promise<`0x${string}`>,
            client.readContract({
              address: ADDRESSES.RiskCircuitBreaker as Address,
              abi: RiskCircuitBreakerAbi,
              functionName: "leaderState",
              args: [addr],
            }) as Promise<[number, bigint, bigint, `0x${string}`]>,
          ]);

          const [bonded, available, locked, _slashed] = status;
          if (!bonded) continue;
          newRows.push({
            address: addr,
            bond: available + locked,
            followers: 0,
            mirrored: 0n,
            state: STATE_NAMES[Number(fsm[0])] ?? "NORMAL",
            lastEvalAt: Number(fsm[1]) * 1000,
            lastArtifactHash: fsm[3],
            strategyCommitment: strategy,
          });
        }

        if (!cancelled) {
          setRows(newRows);
          setLoading(false);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(String((e as { shortMessage?: string }).shortMessage ?? e));
          setLoading(false);
        }
      }
    }

    fetchLeaders();
    const id = setInterval(fetchLeaders, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { rows, loading, error };
}
