/**
 * Real end-to-end integration test against:
 *   - the deployed Mirror contracts on Arc testnet (chain 5042002)
 *   - the real Hyperliquid testnet info endpoint
 *
 * No mocks. No vm.prank. No simulation. Every read is a real eth_call against
 * the live RPC; every market data point is fetched live from the venue.
 *
 * Run:   bun test agent/test/e2e.testnet.test.ts
 */
import { test, expect } from "bun:test";
import { createPublicClient, http, getAddress, parseAbi } from "viem";
import { addressesFromEnv, abis } from "@mirror/shared";
import { hyperliquidConnector } from "../src/venues/hyperliquid.ts";
import { hyperliquidMarketSnapshot } from "../src/market/hyperliquidMacro.ts";
import { classifyRegime } from "../src/regime.ts";
import { computeFeatures } from "../src/features.ts";
import { decide } from "../src/policy.ts";
import { buildArtifact } from "../src/artifact.ts";

const RPC = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 5042002);
const HL_BASE = process.env.HYPERLIQUID_TESTNET_URL ?? "https://api.hyperliquid-testnet.xyz";

const client = createPublicClient({ transport: http(RPC) });

test("RPC: Arc testnet chain id matches env", async () => {
  const id = await client.getChainId();
  expect(id).toBe(CHAIN_ID);
});

test("Deployed contracts: bytecode present at every address", async () => {
  const addrs = addressesFromEnv();
  for (const [name, addr] of Object.entries(addrs) as Array<[string, `0x${string}`]>) {
    const code = await client.getBytecode({ address: addr });
    expect(code, `${name} @ ${addr} has no bytecode`).toBeDefined();
    expect(code!.length, `${name} @ ${addr} bytecode too short`).toBeGreaterThan(2);
  }
});

test("Wiring: LeaderRegistry → RiskCircuitBreaker, AllocationRouter", async () => {
  const a = addressesFromEnv();
  const abi = parseAbi([
    "function USDC() view returns (address)",
    "function RISK_BREAKER() view returns (address)",
    "function ALLOCATION_ROUTER() view returns (address)",
  ]);
  const [usdc, breaker, router] = await Promise.all([
    client.readContract({ address: a.leaderRegistry, abi, functionName: "USDC" }),
    client.readContract({ address: a.leaderRegistry, abi, functionName: "RISK_BREAKER" }),
    client.readContract({ address: a.leaderRegistry, abi, functionName: "ALLOCATION_ROUTER" }),
  ]);
  expect(getAddress(usdc)).toBe(getAddress(a.USDC));
  expect(getAddress(breaker)).toBe(getAddress(a.riskCircuitBreaker));
  expect(getAddress(router)).toBe(getAddress(a.allocationRouter));
});

test("Wiring: AllocationRouter → USDC, AGENT, IDLE (init-once locked)", async () => {
  const a = addressesFromEnv();
  const abi = parseAbi([
    "function USDC() view returns (address)",
    "function AGENT() view returns (address)",
    "function IDLE() view returns (address)",
    "function idleInitialized() view returns (bool)",
  ]);
  const [usdc, agent, idle, locked] = await Promise.all([
    client.readContract({ address: a.allocationRouter, abi, functionName: "USDC" }),
    client.readContract({ address: a.allocationRouter, abi, functionName: "AGENT" }),
    client.readContract({ address: a.allocationRouter, abi, functionName: "IDLE" }),
    client.readContract({ address: a.allocationRouter, abi, functionName: "idleInitialized" }),
  ]);
  expect(getAddress(usdc)).toBe(getAddress(a.USDC));
  expect(agent).toMatch(/^0x[0-9a-fA-F]{40}$/);
  expect(getAddress(idle)).toBe(getAddress(a.idleReserve));
  expect(locked).toBe(true);
});

test("Wiring: LeaderRegistry initialized flag is locked", async () => {
  const a = addressesFromEnv();
  const abi = parseAbi(["function initialized() view returns (bool)"]);
  const locked = await client.readContract({ address: a.leaderRegistry, abi, functionName: "initialized" });
  expect(locked).toBe(true);
});

test("Wiring: RiskCircuitBreaker → LeaderRegistry, AGENT, REBATE_POOL", async () => {
  const a = addressesFromEnv();
  const abi = parseAbi([
    "function LEADERS() view returns (address)",
    "function AGENT() view returns (address)",
    "function REBATE_POOL() view returns (address)",
  ]);
  const [leaders, agent, rebate] = await Promise.all([
    client.readContract({ address: a.riskCircuitBreaker, abi, functionName: "LEADERS" }),
    client.readContract({ address: a.riskCircuitBreaker, abi, functionName: "AGENT" }),
    client.readContract({ address: a.riskCircuitBreaker, abi, functionName: "REBATE_POOL" }),
  ]);
  expect(getAddress(leaders)).toBe(getAddress(a.leaderRegistry));
  expect(agent).toMatch(/^0x[0-9a-fA-F]{40}$/);
  expect(rebate).toMatch(/^0x[0-9a-fA-F]{40}$/);
});

test("Wiring: IdleReserve → USDC, USYC, ROUTER", async () => {
  const a = addressesFromEnv();
  const abi = parseAbi([
    "function USDC() view returns (address)",
    "function USYC() view returns (address)",
    "function ROUTER() view returns (address)",
  ]);
  const [usdc, usyc, router] = await Promise.all([
    client.readContract({ address: a.idleReserve, abi, functionName: "USDC" }),
    client.readContract({ address: a.idleReserve, abi, functionName: "USYC" }),
    client.readContract({ address: a.idleReserve, abi, functionName: "ROUTER" }),
  ]);
  expect(getAddress(usdc)).toBe(getAddress(a.USDC));
  expect(getAddress(usyc)).toBe(getAddress(a.USYC));
  expect(getAddress(router)).toBe(getAddress(a.allocationRouter));
});

test("Wiring: BuilderFeeWrapper splits + BUILDER_CODE", async () => {
  const a = addressesFromEnv();
  const abi = parseAbi([
    "function USDC() view returns (address)",
    "function BUILDER_CODE() view returns (bytes32)",
    "function BPS_TOTAL() view returns (uint256)",
  ]);
  const [usdc, code] = await Promise.all([
    client.readContract({ address: a.builderFeeWrapper, abi, functionName: "USDC" }),
    client.readContract({ address: a.builderFeeWrapper, abi, functionName: "BUILDER_CODE" }),
  ]);
  expect(getAddress(usdc)).toBe(getAddress(a.USDC));
  // "MIRROR" left-padded to bytes32
  expect((code as `0x${string}`).toLowerCase()).toBe("0x4d4952524f520000000000000000000000000000000000000000000000000000");
});

test("LeaderRegistry: live getBondStatus call returns zero state for an unused address", async () => {
  const a = addressesFromEnv();
  const probe = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
  const [bonded, available, locked, slashed] = (await client.readContract({
    address: a.leaderRegistry,
    abi: abis.LeaderRegistryAbi,
    functionName: "getBondStatus",
    args: [probe],
  })) as [boolean, bigint, bigint, bigint];
  expect(bonded).toBe(false);
  expect(available).toBe(0n);
  expect(locked).toBe(0n);
  expect(slashed).toBe(0n);
});

test("Live USDC: deployer balance is non-negative and decimals=6", async () => {
  const a = addressesFromEnv();
  const erc20 = parseAbi([
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ]);
  const deployer = (process.env.DEPLOYER_ADDRESS ?? "0xACE91A3F253FdDba383E65a2bAd50ebB1A92E5b3") as `0x${string}`;
  const [bal, dec, sym] = await Promise.all([
    client.readContract({ address: a.USDC, abi: erc20, functionName: "balanceOf", args: [deployer] }),
    client.readContract({ address: a.USDC, abi: erc20, functionName: "decimals" }),
    client.readContract({ address: a.USDC, abi: erc20, functionName: "symbol" }),
  ]);
  expect(bal).toBeGreaterThanOrEqual(0n);
  expect(dec).toBe(6);
  expect(sym).toBe("USDC");
});

test("Hyperliquid: real macro snapshot returns finite bounded values", async () => {
  const m = await hyperliquidMarketSnapshot();
  expect(Number.isFinite(m.realizedVolBps)).toBe(true);
  expect(Number.isFinite(m.fundingDispersionBps)).toBe(true);
  expect(Number.isFinite(m.correlationStress)).toBe(true);
  expect(m.realizedVolBps).toBeGreaterThanOrEqual(0);
  expect(m.fundingDispersionBps).toBeGreaterThanOrEqual(0);
  expect(m.correlationStress).toBeGreaterThanOrEqual(0);
  // Sanity: realized vol over a day should be < 100% = 10000bps for the universe.
  expect(m.realizedVolBps).toBeLessThan(10_000);
});

test("Hyperliquid: regime classification on live snapshot returns a known label", async () => {
  const m = await hyperliquidMarketSnapshot();
  const regime = classifyRegime(m);
  expect(["LOW_VOL", "TRANSITION", "HIGH_VOL", "DISLOCATION"]).toContain(regime);
});

test("Hyperliquid: connector pulls real clearinghouseState for a fresh address", async () => {
  const probe = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
  const t = await hyperliquidConnector().pullLeaderTelemetry(probe);
  // Even an empty account returns a valid telemetry shape on HL testnet.
  expect(t).not.toBeNull();
  expect(t!.leader).toBe(probe);
  expect(Number.isFinite(t!.currentEquityUsd)).toBe(true);
  expect(Number.isFinite(t!.leverageCurrent)).toBe(true);
  expect(Number.isFinite(t!.leverageDeclaredMax)).toBe(true);
  expect(t!.staleness).toBeGreaterThanOrEqual(0);
});

test("Full pipeline: real market + real telemetry → features → decision → artifact", async () => {
  const [snap, t] = await Promise.all([
    hyperliquidMarketSnapshot(),
    hyperliquidConnector().pullLeaderTelemetry("0x000000000000000000000000000000000000dEaD" as `0x${string}`),
  ]);
  expect(t).not.toBeNull();
  const regime = classifyRegime(snap);
  // 3-sample synthetic history is REPLACED by real polled history in the supervisor loop;
  // here we use the single live observation, which is the real first-tick state.
  const features = computeFeatures(t!, [
    { ts: Math.floor(Date.now() / 1000) - 60, equity: t!.currentEquityUsd },
  ]);
  for (const v of Object.values(features)) {
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  }
  const result = decide(features, regime);
  expect(["MAINTAIN", "WATCH", "ALERT", "SLASH", "ROTATE_TO_USYC"]).toContain(result.decision);
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);

  const { artifact, hash } = buildArtifact({
    agentVersion: "mirror-supervisor/0.1.0-e2e",
    leader: t!.leader,
    regime,
    features,
    thresholds: result.thresholds as unknown as Record<string, number>,
    decision: result.decision,
    parameters: result.parameters,
    confidence: result.confidence,
  });
  expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  expect(artifact.leader).toBe(t!.leader);
  expect(artifact.decision).toBe(result.decision);
});

test("Block sanity: latest Arc testnet block was produced recently", async () => {
  const b = await client.getBlock();
  const ageSec = Math.floor(Date.now() / 1000) - Number(b.timestamp);
  // Arc has sub-second finality; if the latest block is > 5 minutes old something is wrong.
  expect(ageSec).toBeLessThan(300);
});
