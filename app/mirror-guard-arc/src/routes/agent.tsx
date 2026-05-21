import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useBlockNumber } from "wagmi";
import {
  Sparkles,
  Cpu,
  Workflow,
  Activity,
  Gauge,
  FileSearch,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { AddressLink } from "@/components/web3/AddressLink";
import { TxLink } from "@/components/web3/TxLink";
import { LiveNumber } from "@/components/web3/LiveNumber";
import { CircuitBadge, type CircuitState } from "@/components/web3/CircuitBadge";
import { ADDRESSES } from "@/lib/addresses";
import { ARC_TESTNET_ID } from "@/lib/chain";
import { shortAddress, utcStamp } from "@/lib/format";
import { useSupervisorFeed } from "@/hooks/use-supervisor-feed";
import { useLeaders } from "@/hooks/use-leaders";
import { useHLTelemetry } from "@/hooks/use-hl-telemetry";
import { toast } from "sonner";

const STATE_NAMES: CircuitState[] = ["NORMAL", "WATCH", "ALERT", "SLASHING", "COOLDOWN"];

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "Agent — Mirror Protocol" },
      {
        name: "description",
        content:
          "The Circle-signed AI agent that supervises every Mirror leader: telemetry, regime detection, decision artifacts, and on-chain enforcement.",
      },
    ],
  }),
  component: AgentPage,
});

const PIPELINE = [
  { key: "telemetry", label: "Telemetry", icon: <Activity className="size-4" /> },
  { key: "features", label: "Features", icon: <Gauge className="size-4" /> },
  { key: "regime", label: "Regime", icon: <Workflow className="size-4" /> },
  { key: "policy", label: "Policy", icon: <Cpu className="size-4" /> },
  { key: "artifact", label: "Artifact", icon: <FileSearch className="size-4" /> },
  { key: "sign", label: "Sign", icon: <CheckCircle2 className="size-4" /> },
  { key: "commit", label: "Commit", icon: <Sparkles className="size-4" /> },
] as const;

type StepKey = (typeof PIPELINE)[number]["key"];

const FEATURES = [
  { key: "drawdown_realized_bps", label: "Realized drawdown (bps)" },
  { key: "drawdown_velocity_bps_per_hour", label: "Drawdown velocity (bps/h)" },
  { key: "position_concentration_hhi", label: "Position concentration (HHI)" },
  { key: "correlation_drift", label: "Correlation drift" },
  { key: "leverage_current", label: "Leverage current" },
  { key: "leverage_declared_max", label: "Leverage declared max" },
] as const;

function AgentPage() {
  const { data: blockNumber } = useBlockNumber({ chainId: ARC_TESTNET_ID, watch: true });
  const { transitions, agentTxCount } = useSupervisorFeed();
  const { rows: leaders } = useLeaders();
  const [selectedLeader, setSelectedLeader] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!selectedLeader && leaders.length > 0) setSelectedLeader(leaders[0].address);
  }, [leaders, selectedLeader]);
  const { telemetry: hl } = useHLTelemetry(selectedLeader);
  const [selectedStep, setSelectedStep] = React.useState<StepKey>("telemetry");
  const [artifactHash, setArtifactHash] = React.useState("");
  const [artifactState, setArtifactState] = React.useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: unknown }
  >({ status: "idle" });

  const fetchArtifact = async () => {
    if (!artifactHash.trim()) return;
    setArtifactState({ status: "loading" });
    try {
      const url = `https://gateway.pinata.cloud/ipfs/${artifactHash.trim().replace(/^ipfs:\/\//, "")}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
      const data = await res.json();
      setArtifactState({ status: "ok", data });
      toast.success("Artifact loaded from IPFS");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setArtifactState({ status: "error", message });
      toast.error("Failed to fetch artifact");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
      <header className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-mint flex items-center gap-1.5">
          <Sparkles className="size-4" /> Agent
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          The autonomous risk supervisor.
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          A Circle Developer-Controlled wallet, signing decisions every block. Inputs are
          deterministic; outputs are reasoning artifacts pinned to IPFS and committed on Arc.
        </p>
      </header>

      {/* Identity card */}
      <div className="panel p-5 grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Agent identity
          </div>
          <div className="mt-2 flex items-center gap-2">
            <AddressLink address={ADDRESSES.AgentWallet} className="text-base" />
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--mint)_12%,transparent)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-mint">
              Circle
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Recovery file should live encrypted off this machine. Rotate keys via Circle Developer
            Console — never paste seed material into this UI.
          </p>
        </div>
        <Metric
          label="Txs signed (window)"
          value={agentTxCount === null ? null : agentTxCount.toString()}
          hint={agentTxCount === null ? "Loading…" : "Last 5000 blocks"}
        />
        <Metric
          label="Latest Arc block"
          value={blockNumber ? `#${blockNumber.toString()}` : null}
          live
        />
      </div>

      {/* Pipeline */}
      <section>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Workflow className="size-4 text-mint" /> Decision pipeline
        </h2>
        <div className="panel p-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {PIPELINE.map((s, i) => {
              const active = selectedStep === s.key;
              return (
                <React.Fragment key={s.key}>
                  <button
                    onClick={() => setSelectedStep(s.key)}
                    className={
                      "flex flex-col items-center gap-1.5 px-3 py-2 rounded-md border transition-colors min-w-[100px] " +
                      (active
                        ? "border-mint/50 bg-[color-mix(in_oklab,var(--mint)_10%,transparent)] text-mint"
                        : "border-border bg-surface-2 text-muted-foreground hover:text-foreground")
                    }
                  >
                    {s.icon}
                    <span className="text-[11px] uppercase tracking-wider">{s.label}</span>
                  </button>
                  {i < PIPELINE.length - 1 && (
                    <div className="h-px w-6 bg-border shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="mt-4 panel-2 p-4 text-xs text-muted-foreground">
            <span className="uppercase tracking-wider text-foreground/80">
              {PIPELINE.find((p) => p.key === selectedStep)!.label} step
            </span>
            <div className="mt-2">
              No data captured yet for this step. Once the agent processes its first leader, the
              latest input + output for this step will appear here.
            </div>
          </div>
        </div>
      </section>

      {/* Features + regime */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Gauge className="size-4 text-mint" /> Live features per watched leader
            </h2>
            {leaders.length > 0 ? (
              <select
                value={selectedLeader ?? ""}
                onChange={(e) => setSelectedLeader(e.target.value)}
                className="bg-surface-2 border border-border rounded-md px-2 py-1 text-xs num"
              >
                {leaders.map((l) => (
                  <option key={l.address} value={l.address}>
                    {shortAddress(l.address)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] text-muted-foreground">No bonded leaders</span>
            )}
          </div>
          {hl ? (
            <div className="panel-2 p-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-foreground">
                <KV label="HL equity" value={`$${hl.equity.toFixed(4)}`} />
                <KV label="Total notional" value={`$${hl.totalNtl.toFixed(2)}`} />
                <KV label="Leverage" value={`${hl.leverageCurrent.toFixed(2)}x`} />
                <KV label="Unrealized PnL" value={`$${hl.unrealized.toFixed(4)}`} tone={hl.unrealized >= 0 ? "mint" : "bad"} />
                <KV label="Positions" value={String(hl.positions.length)} />
                <KV label="HL spot USDC" value={hl.spotUsdc.toFixed(2)} />
                <KV label="Fetched" value={`${Math.round((Date.now() - hl.fetchedAt) / 1000)}s ago`} />
                <KV label="Source" value="HL testnet API" />
              </div>
              {hl.positions.length > 0 && (
                <div className="mt-3 grid gap-1">
                  {hl.positions.map((p) => (
                    <div key={p.coin} className="flex items-center justify-between panel p-2 text-[11px]">
                      <span className="num text-foreground/80">
                        {p.szi >= 0 ? "LONG" : "SHORT"} {Math.abs(p.szi)} {p.coin} @ ${p.entryPx} ({p.leverage}x)
                      </span>
                      <span className={"num " + (p.unrealizedPnl >= 0 ? "text-mint" : "text-bad")}>
                        {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="panel-2 p-3 text-xs text-muted-foreground">
              {leaders.length === 0
                ? "No leaders bonded yet."
                : "Loading Hyperliquid telemetry…"}
            </div>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.key} className="flex items-center justify-between panel-2 p-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </div>
                  <div className="num text-foreground/80 mt-0.5 text-xs">{f.key}</div>
                </div>
                <span className="num text-base">{featureValue(f.key, hl)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="size-4 text-mint" /> Market regime
          </h2>
          <div className="panel-2 p-4 text-center">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Current</div>
            <div className="mt-1 text-2xl font-semibold text-mint">CALM</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              (default until first signal)
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <RegimeRow label="Realized vol" value="—" />
            <RegimeRow label="Funding dispersion" value="—" />
            <RegimeRow label="Correlation stress" value="—" />
          </div>
        </div>
      </div>

      {/* Artifact viewer */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileSearch className="size-4 text-mint" /> Reasoning artifact viewer
        </h2>
        <div className="panel p-5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Artifact hash (CID)
          </Label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              value={artifactHash}
              onChange={(e) => setArtifactHash(e.target.value)}
              placeholder="bafy… or Qm…"
              className="num bg-surface-2 border-border flex-1"
            />
            <Button onClick={fetchArtifact} disabled={!artifactHash.trim() || artifactState.status === "loading"}>
              {artifactState.status === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Fetch from IPFS"
              )}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Fetched via{" "}
            <span className="num text-foreground/80">gateway.pinata.cloud/ipfs/&lt;cid&gt;</span>.
          </p>

          <div className="mt-4">
            {artifactState.status === "idle" && (
              <div className="panel-2 p-4 text-xs text-muted-foreground">
                Paste any artifact hash from on-chain to render the full reasoning JSON.
              </div>
            )}
            {artifactState.status === "loading" && (
              <div className="panel-2 p-4 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Fetching from gateway…
              </div>
            )}
            {artifactState.status === "error" && (
              <div className="panel-2 p-4 text-xs text-bad flex items-center gap-2">
                <AlertCircle className="size-4" /> {artifactState.message}
              </div>
            )}
            {artifactState.status === "ok" && (
              <pre className="panel-2 p-4 text-xs overflow-x-auto num text-foreground/90 max-h-96">
                {JSON.stringify(artifactState.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </section>

      {/* Recent agent txs */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-mint" /> Recent agent txs
        </h2>
        <div className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Timestamp</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead>Artifact</TableHead>
                <TableHead>Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transitions.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Watching <span className="num">RiskCircuitBreaker.StateTransitioned</span> — no
                    transitions in the last 5000 blocks. The agent only emits events on state
                    changes; evaluate() calls that keep the FSM stable do not show here.
                  </TableCell>
                </TableRow>
              ) : (
                transitions.map((t) => (
                  <TableRow key={t.txHash} className="border-border">
                    <TableCell className="num text-xs">block {t.blockNumber.toString()}</TableCell>
                    <TableCell className="text-xs">
                      <CircuitBadge state={STATE_NAMES[t.from]} small />
                      <span className="mx-1 text-muted-foreground">→</span>
                      <CircuitBadge state={STATE_NAMES[t.to]} small />
                    </TableCell>
                    <TableCell className="num text-xs">{shortAddress(t.leader)}</TableCell>
                    <TableCell className="num text-xs">{shortAddress(t.artifactHash, 6, 4)}</TableCell>
                    <TableCell><TxLink hash={t.txHash} className="text-xs" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Session started <span className="num text-foreground/80">{utcStamp(Date.now())}</span>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  live,
}: {
  label: string;
  value: string | null;
  hint?: string;
  live?: boolean;
}) {
  return (
    <div className="panel-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {live && <span className="size-1.5 rounded-full bg-mint pulse-dot" />}
      </div>
      <div className="mt-1 text-lg font-semibold">
        {value == null ? (
          <span className="text-muted-foreground/70 num">—</span>
        ) : (
          <LiveNumber value={value} />
        )}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function RegimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between panel-2 px-3 py-2">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
      <span className="num text-foreground/80">{value}</span>
    </div>
  );
}

function KV({ label, value, tone }: { label: string; value: string; tone?: "mint" | "bad" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={
          "mt-0.5 num text-sm font-semibold " +
          (tone === "mint" ? "text-mint" : tone === "bad" ? "text-bad" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}

function featureValue(
  key: string,
  hl: import("@/hooks/use-hl-telemetry").HLTelemetry | null,
): string {
  if (!hl) return "—";
  if (key === "leverage_current") return hl.leverageCurrent.toFixed(2);
  if (key === "leverage_declared_max") {
    return String(hl.positions.reduce((m, p) => Math.max(m, p.leverage), 1));
  }
  if (key === "position_concentration_hhi") {
    const total = hl.positions.reduce((s, p) => s + Math.abs(p.szi * p.entryPx), 0) || 1;
    const hhi = hl.positions.reduce(
      (acc, p) => acc + ((Math.abs(p.szi * p.entryPx) / total) ** 2),
      0,
    );
    return Math.round(hhi * 10_000).toString();
  }
  // drawdown_realized_bps, drawdown_velocity_bps_per_hour, correlation_drift
  // require historical data the client can't compute alone — show "live"
  // and let the on-chain artifact provide the canonical value.
  return "live";
}
