import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { abis } from "@mirror/shared";

import { addresses } from "../lib/addresses";
import { fmtUsdc, bpsToPct, shorten } from "../lib/format";
import { ConnectButton } from "../components/ConnectButton";

const PROFILES = ["Conservative", "Balanced", "Aggressive"] as const;

export default function Follower() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("100");
  const [profile, setProfile] = useState<0 | 1 | 2>(1);
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: principal } = useReadContract({
    address: addresses.allocationRouter,
    abi: abis.AllocationRouterAbi,
    functionName: "getPrincipal",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: profileOnChain } = useReadContract({
    address: addresses.allocationRouter,
    abi: abis.AllocationRouterAbi,
    functionName: "getProfile",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: vector } = useReadContract({
    address: addresses.allocationRouter,
    abi: abis.AllocationRouterAbi,
    functionName: "getAllocation",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  async function approveAndDeposit() {
    if (!address) return;
    const value = parseUnits(amount || "0", 6);
    await writeContractAsync({
      address: addresses.USDC,
      abi: abis.Erc20Abi,
      functionName: "approve",
      args: [addresses.allocationRouter, value],
    });
    await writeContractAsync({
      address: addresses.allocationRouter,
      abi: abis.AllocationRouterAbi,
      functionName: "deposit",
      args: [value, profile],
    });
  }

  async function withdrawAll() {
    if (!principal) return;
    await writeContractAsync({
      address: addresses.allocationRouter,
      abi: abis.AllocationRouterAbi,
      functionName: "withdraw",
      args: [principal as bigint],
    });
  }

  return (
    <>
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Follower</h2>
          <ConnectButton />
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <h2>Deposit</h2>
          <div className="row">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
            <select value={profile} onChange={(e) => setProfile(Number(e.target.value) as 0 | 1 | 2)}>
              {PROFILES.map((p, i) => <option key={p} value={i}>{p}</option>)}
            </select>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Two signatures: USDC approval + AllocationRouter.deposit. Gas pays in USDC via Circle Paymaster.
          </p>
          <button disabled={isPending || !address} onClick={approveAndDeposit}>
            {isPending ? "Submitting…" : "Approve & Deposit"}
          </button>
        </div>

        <div className="panel">
          <h2>Position</h2>
          <div className="kv"><span>Principal</span><span className="mono">{fmtUsdc(principal as bigint | undefined)}</span></div>
          <div className="kv"><span>Profile</span><span>{profileOnChain !== undefined ? PROFILES[profileOnChain as number] : "—"}</span></div>
          <div className="kv"><span>Entries</span><span>{Array.isArray(vector) ? (vector as unknown[]).length : 0}</span></div>
          <button disabled={!principal} onClick={withdrawAll} style={{ marginTop: 12 }}>Withdraw All</button>
        </div>
      </div>

      <div className="panel">
        <h2>Allocation Vector</h2>
        {Array.isArray(vector) && (vector as unknown[]).length > 0 ? (
          (vector as Array<{ leader: string; weightBps: number; lastUpdated: bigint }>).map((e) => (
            <div className="kv" key={e.leader}>
              <span className="mono">{shorten(e.leader)}</span>
              <span>{bpsToPct(e.weightBps)}</span>
            </div>
          ))
        ) : (
          <p className="muted">No allocation yet. The supervisor will route your deposit once a tick fires.</p>
        )}
      </div>
    </>
  );
}
