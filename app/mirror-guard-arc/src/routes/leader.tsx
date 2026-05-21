import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { motion } from "framer-motion";
import { keccak256, parseUnits, toBytes, type Address } from "viem";
import { Shield, FileSignature, Clock, ArrowDownToLine, Activity, Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { CircuitBadge, type CircuitState } from "@/components/web3/CircuitBadge";
import { StateTransitionTimeline } from "@/components/web3/StateTransitionTimeline";
import { DrawdownChart } from "@/components/web3/DrawdownChart";
import { AddressLink } from "@/components/web3/AddressLink";
import { ConnectWallet } from "@/components/web3/ConnectWallet";
import { ADDRESSES } from "@/lib/addresses";
import { ARC_TESTNET_ID } from "@/lib/chain";
import { formatUsdc, utcStamp } from "@/lib/format";
import { LeaderRegistryAbi, RiskCircuitBreakerAbi, Erc20Abi } from "@/abi";
import { toast } from "sonner";

export const Route = createFileRoute("/leader")({
  head: () => ({
    meta: [
      { title: "Leader — Mirror Protocol" },
      {
        name: "description",
        content:
          "Post a USDC performance bond, commit your strategy on-chain, and watch the AI risk supervisor monitor your FSM state in real time.",
      },
    ],
  }),
  component: LeaderPage,
});

const STATE_NAMES: CircuitState[] = ["NORMAL", "WATCH", "ALERT", "SLASHING", "COOLDOWN"];

function LeaderPage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = React.useState("1000");
  const [strategy, setStrategy] = React.useState("");

  // --- live reads -------------------------------------------------------
  const { data: bondStatus, refetch: refetchBond } = useReadContract({
    address: ADDRESSES.LeaderRegistry as Address,
    abi: LeaderRegistryAbi,
    functionName: "getBondStatus",
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const { data: fsmRaw, refetch: refetchFsm } = useReadContract({
    address: ADDRESSES.RiskCircuitBreaker as Address,
    abi: RiskCircuitBreakerAbi,
    functionName: "leaderState",
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const { data: allowance } = useReadContract({
    address: ADDRESSES.USDC as Address,
    abi: Erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDRESSES.LeaderRegistry as Address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const { data: usdcBalance } = useReadContract({
    address: ADDRESSES.USDC as Address,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const [bonded, available, locked, slashed] =
    (bondStatus as [boolean, bigint, bigint, bigint] | undefined) ?? [false, 0n, 0n, 0n];

  const fsm = fsmRaw as [number, bigint, bigint, `0x${string}`] | undefined;
  const stateNum = fsm?.[0] ?? 0;
  const state: CircuitState = STATE_NAMES[stateNum] ?? "NORMAL";
  const lastArtifactHash = fsm?.[3];

  const commitment = React.useMemo(() => {
    if (!strategy.trim()) return null;
    return keccak256(toBytes(strategy.trim()));
  }, [strategy]);

  // --- writes -----------------------------------------------------------
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [pendingTxHash, setPendingTxHash] = React.useState<`0x${string}` | null>(null);
  const { isLoading: isMining, isSuccess: txMined } = useWaitForTransactionReceipt({
    hash: pendingTxHash ?? undefined,
    chainId: ARC_TESTNET_ID,
  });

  React.useEffect(() => {
    if (txMined && pendingTxHash) {
      refetchBond();
      refetchFsm();
      setPendingTxHash(null);
    }
  }, [txMined, pendingTxHash, refetchBond, refetchFsm]);

  const amountWei = React.useMemo(() => {
    try {
      return parseUnits(amount || "0", 6);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApprove = (allowance as bigint | undefined ?? 0n) < amountWei;

  async function handlePostBond() {
    if (!address || !commitment || amountWei <= 0n) return;
    try {
      if (needsApprove) {
        toast.info("Step 1/2 · Approving USDC…");
        const approveHash = await writeContractAsync({
          address: ADDRESSES.USDC as Address,
          abi: Erc20Abi,
          functionName: "approve",
          args: [ADDRESSES.LeaderRegistry as Address, amountWei],
          chainId: ARC_TESTNET_ID,
        });
        setPendingTxHash(approveHash);
        toast.success(`Approve submitted ${approveHash.slice(0, 10)}…`);
        // Wait for the receipt before posting bond.
        await new Promise((r) => setTimeout(r, 4000));
      }
      toast.info(bonded ? "topUpBond…" : "postBond…");
      const bondHash = bonded
        ? await writeContractAsync({
            address: ADDRESSES.LeaderRegistry as Address,
            abi: LeaderRegistryAbi,
            functionName: "topUpBond",
            args: [amountWei],
            chainId: ARC_TESTNET_ID,
          })
        : await writeContractAsync({
            address: ADDRESSES.LeaderRegistry as Address,
            abi: LeaderRegistryAbi,
            functionName: "postBond",
            args: [amountWei, commitment],
            chainId: ARC_TESTNET_ID,
          });
      setPendingTxHash(bondHash);
      toast.success(`Bond tx submitted ${bondHash.slice(0, 10)}…`);
    } catch (e) {
      toast.error((e as { shortMessage?: string; message?: string }).shortMessage ?? String(e));
    }
  }

  async function handleScheduleWithdraw() {
    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.LeaderRegistry as Address,
        abi: LeaderRegistryAbi,
        functionName: "scheduleWithdraw",
        args: [],
        chainId: ARC_TESTNET_ID,
      });
      setPendingTxHash(hash);
      toast.success("7-day cooldown started");
    } catch (e) {
      toast.error((e as { shortMessage?: string; message?: string }).shortMessage ?? String(e));
    }
  }

  async function handleWithdrawBond() {
    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.LeaderRegistry as Address,
        abi: LeaderRegistryAbi,
        functionName: "withdrawBond",
        args: [],
        chainId: ARC_TESTNET_ID,
      });
      setPendingTxHash(hash);
      toast.success("Withdrawing bond…");
    } catch (e) {
      toast.error((e as { shortMessage?: string; message?: string }).shortMessage ?? String(e));
    }
  }

  const isBusy = isWriting || isMining;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
      <header className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-mint flex items-center gap-1.5">
          <Shield className="size-4" /> Leader
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Bond, declare, and trade under supervision.
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Post a USDC performance bond to LeaderRegistry. Your strategy hash is committed on-chain.
          The agent monitors realized drawdown, leverage and concentration every block.
        </p>
      </header>

      {!isConnected && <ConnectGate />}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Bond status */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-5 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="size-4 text-mint" /> Bond status
            </h2>
            <CircuitBadge state={state} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Bonded" value={bonded ? "Yes" : "No"} tone={bonded ? "mint" : "muted"} />
            <Stat label="Available USDC" value={formatUsdc(available)} />
            <Stat label="Locked USDC" value={formatUsdc(locked)} />
            <Stat label="Slashed (historical)" value={formatUsdc(slashed)} tone="bad-soft" />
          </div>
          <div className="mt-6">
            <StateTransitionTimeline current={state} />
          </div>
          {lastArtifactHash && lastArtifactHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
            <div className="mt-4 panel-2 p-3 text-xs">
              <div className="uppercase tracking-wider text-muted-foreground mb-1">Last artifact hash</div>
              <code className="num break-all text-foreground/80">{lastArtifactHash}</code>
            </div>
          )}
        </motion.div>

        {/* Strategy commitment */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="panel p-5"
        >
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <FileSignature className="size-4 text-mint" /> Strategy commitment
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            keccak256 of your strategy description. Hashed client-side; only the hash is posted to{" "}
            <span className="num text-foreground/80">LeaderRegistry.postBond</span>.
          </p>
          <div className="panel-2 p-3">
            <code className="num text-xs break-all text-foreground/80">
              {commitment ?? "0x… (enter a strategy below)"}
            </code>
          </div>
          {address && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              USDC balance: <span className="num text-foreground/80">{formatUsdc(usdcBalance as bigint | undefined)}</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Post bond form + actions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-4">{bonded ? "Top up bond" : "Post bond"}</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount" className="text-xs uppercase tracking-wider text-muted-foreground">
                USDC amount
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16 num bg-surface-2 border-border h-11 text-base"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wider text-muted-foreground">
                  USDC
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="strategy" className="text-xs uppercase tracking-wider text-muted-foreground">
                Strategy declaration {bonded && <span className="text-muted-foreground/60">(committed already)</span>}
              </Label>
              <Textarea
                id="strategy"
                placeholder="e.g. Long-bias BTC/ETH momentum with 3x max leverage; rotates to USYC on regime=STRESSED."
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                disabled={bonded}
                className="mt-1.5 bg-surface-2 border-border min-h-[110px]"
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={!isConnected || isBusy || (!bonded && !strategy.trim()) || amountWei <= 0n}
              onClick={handlePostBond}
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
              {isBusy
                ? "Submitting…"
                : bonded
                ? "Top up bond"
                : needsApprove
                ? "Approve & post bond"
                : "Post bond"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Posts to <span className="num">LeaderRegistry</span> ·{" "}
              <AddressLink address={ADDRESSES.LeaderRegistry} className="text-[11px]" />
            </p>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-4">Bond actions</h2>
          <div className="space-y-3">
            <ActionRow
              icon={<Clock className="size-4" />}
              title="Schedule withdraw"
              description="Starts the 7-day cooldown. Requires no locked positions."
              cta="Schedule"
              disabled={!bonded || isBusy}
              onClick={handleScheduleWithdraw}
            />
            <ActionRow
              icon={<ArrowDownToLine className="size-4" />}
              title="Withdraw bond"
              description="Available after cooldown completes and locked = 0."
              cta="Withdraw"
              disabled={!bonded || locked > 0n || isBusy}
              onClick={handleWithdrawBond}
            />
            <div className="panel-2 p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Locked</span>
                <span className="num text-foreground/80">{formatUsdc(locked)} USDC</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drawdown chart */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-mint" /> Live drawdown · last 60 min
          </h2>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Source: HL clearinghouse + RiskCircuitBreaker
          </span>
        </div>
        <DrawdownChart />
      </div>

      {/* Supervisor decisions */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-mint" /> Recent supervisor decisions
          </h2>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            From RiskCircuitBreaker.StateTransitioned
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Timestamp</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Artifact</TableHead>
                <TableHead>Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-border">
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  Live FSM transitions stream into the homepage feed. This table will populate once your leader address transitions.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Session start <span className="num text-foreground/80">{utcStamp(Date.now())}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "muted" | "mint" | "bad-soft";
}) {
  return (
    <div className="panel-2 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 text-lg font-semibold num " +
          (tone === "muted"
            ? "text-muted-foreground"
            : tone === "mint"
            ? "text-mint"
            : tone === "bad-soft"
            ? "text-bad/80"
            : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  description,
  cta,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 panel-2 p-3">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-md bg-surface border border-border grid place-items-center text-muted-foreground">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onClick}>
        {cta}
      </Button>
    </div>
  );
}

function ConnectGate() {
  return (
    <div className="panel p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">Connect a wallet on Arc Testnet</div>
        <div className="text-xs text-muted-foreground">
          You'll need ARC for gas and testnet USDC for the bond.
        </div>
      </div>
      <ConnectWallet />
    </div>
  );
}
