import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAccount, useReadContract } from "wagmi";
import { Users, Wallet, ArrowRight, History, Layers } from "lucide-react";
import type { Address } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { LeaderTable, type LeaderRow } from "@/components/web3/LeaderTable";
import { AddressLink } from "@/components/web3/AddressLink";
import { ConnectWallet } from "@/components/web3/ConnectWallet";
import { ADDRESSES } from "@/lib/addresses";
import { useLeaders } from "@/hooks/use-leaders";
import { Erc20Abi } from "@/abi";
import { ARC_TESTNET_ID } from "@/lib/chain";
import { formatUsdc } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/follower")({
  head: () => ({
    meta: [
      { title: "Follower — Mirror Protocol" },
      {
        name: "description",
        content:
          "Pick a bonded leader, choose a risk profile, and mirror their Hyperliquid trades. Receive a USDC rebate if the agent slashes the bond.",
      },
    ],
  }),
  component: FollowerPage,
});

const RISK_PROFILES = [
  { id: "conservative", label: "Conservative", ratio: 0.25, desc: "25% mirror ratio" },
  { id: "balanced", label: "Balanced", ratio: 0.5, desc: "50% mirror ratio" },
  { id: "aggressive", label: "Aggressive", ratio: 1.0, desc: "100% mirror ratio" },
] as const;

function FollowerPage() {
  const { isConnected } = useAccount();
  const [selected, setSelected] = React.useState<LeaderRow | null>(null);
  const [depositAmount, setDepositAmount] = React.useState("500");
  const [risk, setRisk] = React.useState<(typeof RISK_PROFILES)[number]["id"]>("balanced");

  const { rows, loading: leadersLoading } = useLeaders();

  const profile = RISK_PROFILES.find((p) => p.id === risk)!;
  const exposure = (Number(depositAmount) || 0) * profile.ratio;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
      <header className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-mint flex items-center gap-1.5">
          <Users className="size-4" /> Follower
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Mirror bonded leaders. Earn rebates on slashes.
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Deposit USDC into AllocationRouter and pick a leader. If the AI agent slashes their bond,
          you receive a proportional rebate from the slashed amount.
        </p>
      </header>

      {/* Wallet balances */}
      <div className="grid gap-5 md:grid-cols-3">
        <BalanceCard
          asset="USDC"
          decimals={6}
          address={ADDRESSES.USDC}
          help="Settlement asset for deposits and slash rebates."
          connected={isConnected}
        />
        <BalanceCard
          asset="USYC"
          decimals={6}
          address={ADDRESSES.USYC}
          help="Yield-bearing rotation asset (defensive regime)."
          connected={isConnected}
        />
        <div className="panel p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Faucet</div>
          <h3 className="mt-1 text-base font-semibold">Need testnet USDC?</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Request Arc testnet ARC and USDC to test deposits and mirroring.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
            <a href="https://faucet.testnet.arc.network" target="_blank" rel="noreferrer">
              Open faucet <ArrowRight className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Leaderboard */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Layers className="size-4 text-mint" /> Leader leaderboard
        </h2>
        <LeaderTable rows={rows} loading={leadersLoading} onMirror={(r) => setSelected(r)} />
        {!leadersLoading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            No leaders bonded yet on this testnet session. Once a leader posts a bond to{" "}
            <AddressLink address={ADDRESSES.LeaderRegistry} className="text-xs" />, they'll appear here.
          </p>
        )}
      </section>

      {/* Active allocations */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Wallet className="size-4 text-mint" /> Your active allocations
        </h2>
        <div className="panel p-5">
          <div className="text-sm text-muted-foreground text-center py-6">
            {isConnected
              ? "You have no active mirror allocations."
              : "Connect a wallet to view your allocations."}
          </div>
        </div>
      </section>

      {/* Rebate history */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <History className="size-4 text-mint" /> Rebate history
        </h2>
        <div className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Timestamp</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead className="text-right">Slash amount</TableHead>
                <TableHead className="text-right">Your rebate</TableHead>
                <TableHead>Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No slash events yet.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Deposit & mirror dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mirror leader</DialogTitle>
            <DialogDescription>
              Deposit USDC into AllocationRouter and start mirroring this leader's Hyperliquid PnL.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="panel-2 p-3 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Leader</span>
                <AddressLink address={selected.address} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  USDC amount
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="pr-16 num bg-surface-2 border-border h-11"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wider text-muted-foreground">
                    USDC
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Risk profile
                </Label>
                <RadioGroup
                  value={risk}
                  onValueChange={(v) => setRisk(v as typeof risk)}
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {RISK_PROFILES.map((p) => (
                    <Label
                      key={p.id}
                      htmlFor={`risk-${p.id}`}
                      className={
                        "panel-2 p-2.5 cursor-pointer text-left flex flex-col gap-0.5 transition-colors " +
                        (risk === p.id ? "border-mint/50" : "")
                      }
                    >
                      <RadioGroupItem id={`risk-${p.id}`} value={p.id} className="sr-only" />
                      <span className="text-xs font-medium">{p.label}</span>
                      <span className="text-[10px] text-muted-foreground num">{p.desc}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <div className="panel-2 p-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Expected exposure</span>
                <span className="num font-semibold text-foreground">
                  {exposure.toFixed(2)} USDC
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast("Two-tx flow: 1) Approve USDC  2) AllocationRouter.deposit", {
                  description: "Wire ABI calls in next pass.",
                });
                setSelected(null);
              }}
            >
              Approve USDC + Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BalanceCard({
  asset,
  address,
  help,
  connected,
}: {
  asset: string;
  decimals: number;
  address: string;
  help: string;
  connected: boolean;
}) {
  const { address: user } = useAccount();
  const { data: balance } = useReadContract({
    address: address as Address,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!user, refetchInterval: 12_000 },
  });

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-surface-2 border border-border grid place-items-center text-[10px] num font-semibold">
            {asset.slice(0, 4)}
          </div>
          <span className="text-sm font-medium">{asset}</span>
        </div>
        <AddressLink address={address} className="text-xs" />
      </div>
      <div className="mt-3 text-2xl font-semibold num">
        {connected && balance !== undefined ? (
          <span>{formatUsdc(balance as bigint)}</span>
        ) : (
          <span className="text-muted-foreground/70">—</span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {connected ? `${asset} balance · refreshes every 12s` : "Connect wallet to read balance."}
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground/80">{help}</div>
    </div>
  );
}
