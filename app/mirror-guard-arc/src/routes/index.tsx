import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Users,
  Activity,
  Boxes,
  ChevronDown,
  Eye,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AddressLink } from "@/components/web3/AddressLink";
import { LiveNumber } from "@/components/web3/LiveNumber";
import { CircuitBadge, type CircuitState } from "@/components/web3/CircuitBadge";
import { TxLink } from "@/components/web3/TxLink";
import { ConnectWallet } from "@/components/web3/ConnectWallet";
import { ADDRESSES, CONTRACT_LIST } from "@/lib/addresses";
import { explorerBlock } from "@/lib/chain";
import { formatUsdc, shortAddress, utcStamp } from "@/lib/format";
import { useSupervisorFeed, type TransitionEvent } from "@/hooks/use-supervisor-feed";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mirror Protocol — Live AI risk supervisor on Arc" },
      {
        name: "description",
        content:
          "Watch a Circle-signed AI agent supervise Hyperliquid leaders 24/7 on Arc testnet. Bonded leaders, slashed in sub-second finality.",
      },
    ],
  }),
  component: HomePage,
});

const STATE_NAMES: CircuitState[] = ["NORMAL", "WATCH", "ALERT", "SLASHING", "COOLDOWN"];

function HomePage() {
  const { blockNumber, transitions, agentTxCount, agentTxLifetime, leaderCount, totalBondedRaw } = useSupervisorFeed();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero */}
      <section className="relative overflow-hidden panel p-8 sm:p-12">
        <div className="absolute inset-0 -z-10 opacity-50">
          <div className="absolute -top-32 -left-32 size-[480px] rounded-full bg-mint/15 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 size-[480px] rounded-full bg-chart-4/10 blur-3xl" />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-mint pulse-dot" />
              Agent online
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-2.5 py-1 num normal-case">
              Chain 5042002 · Arc Testnet
            </span>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]"
          >
            Slash-bonded social trading,
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-r from-mint to-chart-4 bg-clip-text text-transparent">
              supervised by an AI agent.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="max-w-2xl text-base sm:text-lg text-muted-foreground"
          >
            Hyperliquid leaders post USDC performance bonds on Arc. Followers mirror their trades.
            A Circle-signed agent watches each leader 24/7 — when risk crosses thresholds, the
            bond slashes in sub-second finality and pays followers a rebate.
          </motion.p>

          <div className="flex flex-wrap items-center gap-3">
            <ConnectWallet />
            <Button asChild variant="outline" size="sm" className="gap-1">
              <a href="#contracts">
                See deployed contracts <ChevronDown className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Supervisor Activity */}
      <section className="mt-10">
        <SectionHeader
          icon={<Activity className="size-4" />}
          eyebrow="Live"
          title="Supervisor Activity"
          subtitle="Real-time view of the Mirror AI agent operating on Arc."
        />
        <div className="grid gap-3 mt-5 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Latest Arc block" value={blockNumber} format={(v) => `#${v}`} live />
          <StatCard
            label="Agent txs (lifetime)"
            value={agentTxLifetime ?? null}
            hint={
              agentTxLifetime === null
                ? "Loading…"
                : agentTxCount === null
                ? "Lifetime nonce"
                : `${agentTxCount} in last 5000 blocks`
            }
          />
          <StatCard
            label="Bonded leaders"
            value={leaderCount ?? null}
            hint={leaderCount === null ? "Loading…" : leaderCount === 0n ? "No leaders bonded yet" : undefined}
          />
          <StatCard
            label="Total bonded (USDC)"
            value={totalBondedRaw === null ? null : formatUsdc(totalBondedRaw)}
            hint={totalBondedRaw === null ? "Loading…" : undefined}
          />
        </div>

        <div className="grid mt-5 gap-5 lg:grid-cols-3">
          {/* Event feed */}
          <div className="panel p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="size-4 text-mint" /> FSM transition feed
              </h3>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Last 10 events
              </span>
            </div>
            {transitions.length === 0 ? <EmptyFeed /> : <TransitionFeed events={transitions} />}
          </div>

          {/* Agent wallet card */}
          <AgentCard txCount={agentTxCount} />
        </div>
      </section>

      {/* CTA Cards */}
      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <CtaCard
          to="/leader"
          eyebrow="For Leaders"
          title="Post a USDC bond"
          description="Declare your strategy on-chain, accept slash conditions, and start earning from mirrored flow."
          icon={<Shield className="size-5" />}
        />
        <CtaCard
          to="/follower"
          eyebrow="For Followers"
          title="Deposit & mirror"
          description="Pick a bonded leader. Mirror their Hyperliquid trades. Get paid a rebate if the agent slashes them."
          icon={<Users className="size-5" />}
        />
      </section>

      {/* Deployed Contracts */}
      <section id="contracts" className="mt-14 scroll-mt-24">
        <SectionHeader
          icon={<Boxes className="size-4" />}
          eyebrow="On-chain"
          title="Deployed contracts"
          subtitle="All seven contracts that compose the Mirror Protocol on Arc Testnet."
        />
        <div className="panel mt-5 overflow-hidden">
          <Accordion type="single" collapsible defaultValue="contracts">
            <AccordionItem value="contracts" className="border-0">
              <AccordionTrigger className="px-5 hover:no-underline">
                <span className="text-sm font-medium">{CONTRACT_LIST.length} contracts deployed</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="divide-y divide-border">
                  {CONTRACT_LIST.map((c) => (
                    <div
                      key={c.name}
                      className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      </div>
                      <AddressLink address={c.address} className="text-sm" />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14">
        <SectionHeader
          icon={<Layers className="size-4" />}
          eyebrow="Flow"
          title="How it works"
        />
        <div className="grid gap-4 mt-5 md:grid-cols-3 relative">
          <FlowStep n={1} title="Leader bonds USDC" icon={<Shield className="size-5" />}>
            A leader posts a USDC bond to LeaderRegistry and commits to a strategy hash.
          </FlowStep>
          <FlowStep n={2} title="Followers mirror" icon={<Users className="size-5" />}>
            Followers deposit into AllocationRouter and mirror that leader's Hyperliquid PnL.
          </FlowStep>
          <FlowStep
            n={3}
            title="AI supervisor enforces"
            icon={<Sparkles className="size-5" />}
          >
            Agent watches drawdown, concentration, leverage. Crosses a threshold → slash &amp; rebate.
          </FlowStep>
        </div>
      </section>

      {/* Block hint */}
      {blockNumber !== undefined && (
        <div className="mt-10 text-center text-xs text-muted-foreground">
          Watching{" "}
          <a
            href={explorerBlock(blockNumber)}
            target="_blank"
            rel="noreferrer"
            className="num text-foreground/80 hover:text-mint"
          >
            block #{blockNumber.toString()}
          </a>{" "}
          on Arc Testnet.
        </div>
      )}
    </div>
  );
}

/* ---------- Subcomponents (file-local) ---------- */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  icon,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-mint flex items-center gap-1.5">
          {icon}
          {eyebrow}
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  format,
  hint,
  live,
}: {
  label: string;
  value: bigint | number | string | null | undefined;
  format?: (v: number | string) => string;
  hint?: string;
  live?: boolean;
}) {
  const v =
    typeof value === "bigint" ? value.toString() : (value as number | string | null | undefined);
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {live && <span className="size-1.5 rounded-full bg-mint pulse-dot" />}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {v == null ? (
          <span className="text-muted-foreground/70 num">—</span>
        ) : (
          <LiveNumber value={v} format={format} />
        )}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="panel-2 p-6 text-center">
      <div className="text-sm text-foreground/80">
        No FSM transitions in the last 5000 blocks.
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        The supervisor is evaluating every 15s; the FSM transitions only when a leader's drawdown
        crosses a threshold. Watching{" "}
        <code className="num text-foreground/80">RiskCircuitBreaker.StateTransitioned</code>.
      </div>
      <div className="mt-4 flex flex-col gap-2 max-w-md mx-auto">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-10 rounded-md border border-dashed border-border/60 bg-surface-2/30"
          />
        ))}
      </div>
    </div>
  );
}

function TransitionFeed({ events }: { events: TransitionEvent[] }) {
  return (
    <ul className="divide-y divide-border">
      {events.map((e) => (
        <li key={e.txHash} className="py-2 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="num text-foreground/80">{shortAddress(e.leader)}</span>
            <CircuitBadge state={STATE_NAMES[e.from]} small />
            <span className="text-muted-foreground">→</span>
            <CircuitBadge state={STATE_NAMES[e.to]} small />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="num text-muted-foreground">block {e.blockNumber.toString()}</span>
            <TxLink hash={e.txHash} className="text-xs" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AgentCard({ txCount }: { txCount: number | null }) {
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="size-4 text-mint" /> Agent wallet
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--mint)_12%,transparent)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-mint">
          Circle signed
        </span>
      </div>
      <div className="space-y-3 text-xs">
        <Row label="Identity">
          <AddressLink address={ADDRESSES.AgentWallet} className="text-sm" />
        </Row>
        <Row label="Type">Developer-Controlled (Circle)</Row>
        <Row label="Txs (window)">
          <span className="num text-foreground/80">{txCount ?? "—"}</span>
        </Row>
        <Row label="Session start">
          <span className="num">{utcStamp(Date.now())}</span>
        </Row>
        <CircuitBadge state="NORMAL" />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="uppercase tracking-wider text-[10px] text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function CtaCard({
  to,
  eyebrow,
  title,
  description,
  icon,
}: {
  to: "/leader" | "/follower";
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group panel p-6 hover:border-mint/50 transition-colors relative overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-mint/0 via-mint/0 to-mint/0 group-hover:from-mint/[0.04] group-hover:to-mint/[0.10] transition-colors" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-mint">
          {icon}
          {eyebrow}
        </div>
        <ArrowRight className="size-4 text-muted-foreground group-hover:text-mint group-hover:translate-x-0.5 transition-all" />
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function FlowStep({
  n,
  title,
  children,
  icon,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="panel p-5 relative">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-md bg-surface-2 border border-border grid place-items-center text-mint">
          {icon}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Step {n}</div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{children}</p>
        </div>
      </div>
    </div>
  );
}
