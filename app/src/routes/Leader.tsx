import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { keccak256, parseUnits, toBytes } from "viem";
import { abis } from "@mirror/shared";

import { addresses } from "../lib/addresses";
import { fmtUsdc } from "../lib/format";
import { ConnectButton } from "../components/ConnectButton";
import { CircuitBadge } from "../components/CircuitBadge";

export default function Leader() {
  const { address } = useAccount();
  const [bond, setBond] = useState("1000");
  const [strategy, setStrategy] = useState("Perps long-only momentum, max 5x");
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: status } = useReadContract({
    address: addresses.leaderRegistry,
    abi: abis.LeaderRegistryAbi,
    functionName: "getBondStatus",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: fsm } = useReadContract({
    address: addresses.riskCircuitBreaker,
    abi: abis.RiskCircuitBreakerAbi,
    functionName: "leaderState",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: inflow } = useReadContract({
    address: addresses.allocationRouter,
    abi: abis.AllocationRouterAbi,
    functionName: "leaderInflow",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  async function postBond() {
    if (!address) return;
    const value = parseUnits(bond || "0", 6);
    const commitment = keccak256(toBytes(strategy));
    await writeContractAsync({
      address: addresses.USDC,
      abi: abis.Erc20Abi,
      functionName: "approve",
      args: [addresses.leaderRegistry, value],
    });
    await writeContractAsync({
      address: addresses.leaderRegistry,
      abi: abis.LeaderRegistryAbi,
      functionName: "postBond",
      args: [value, commitment],
    });
  }

  async function scheduleWithdraw() {
    await writeContractAsync({
      address: addresses.leaderRegistry,
      abi: abis.LeaderRegistryAbi,
      functionName: "scheduleWithdraw",
      args: [],
    });
  }

  async function withdrawBond() {
    await writeContractAsync({
      address: addresses.leaderRegistry,
      abi: abis.LeaderRegistryAbi,
      functionName: "withdrawBond",
      args: [],
    });
  }

  const [bonded, available, locked, slashed] = (status as [boolean, bigint, bigint, bigint] | undefined) ?? [false, 0n, 0n, 0n];
  const fsmState = (fsm as [number, bigint, bigint, `0x${string}`] | undefined)?.[0];

  return (
    <>
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Leader</h2>
          <ConnectButton />
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <h2>Post Bond</h2>
          <div className="row" style={{ marginBottom: 8 }}>
            <input value={bond} onChange={(e) => setBond(e.target.value)} placeholder="USDC" style={{ flex: 1 }} />
          </div>
          <input
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            placeholder="Strategy declaration"
            style={{ width: "100%", marginBottom: 8 }}
          />
          <p className="muted" style={{ fontSize: 12 }}>
            The strategy text is hashed and committed on-chain. The preimage is pinned off-chain.
          </p>
          <button disabled={isPending || !address || bonded} onClick={postBond}>
            {bonded ? "Already Bonded" : isPending ? "Submitting…" : "Approve & Post Bond"}
          </button>
        </div>

        <div className="panel">
          <h2>Bond Status</h2>
          <div className="kv"><span>Bonded</span><span>{bonded ? "Yes" : "No"}</span></div>
          <div className="kv"><span>Available</span><span className="mono">{fmtUsdc(available)}</span></div>
          <div className="kv"><span>Locked</span><span className="mono">{fmtUsdc(locked)}</span></div>
          <div className="kv"><span>Slashed</span><span className="mono">{fmtUsdc(slashed)}</span></div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button disabled={!bonded || isPending} onClick={scheduleWithdraw}>Schedule Withdraw</button>
            <button disabled={!bonded || isPending || locked !== 0n} onClick={withdrawBond}>Withdraw</button>
          </div>
        </div>

        <div className="panel">
          <h2>Circuit Breaker</h2>
          <div className="kv"><span>State</span><CircuitBadge state={fsmState} /></div>
          <div className="kv"><span>Follower inflow</span><span className="mono">{fmtUsdc(inflow as bigint | undefined)}</span></div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            The supervisor re-evaluates this leader every tick. State transitions are committed on-chain
            with the corresponding reasoning artifact hash.
          </p>
        </div>
      </div>
    </>
  );
}
