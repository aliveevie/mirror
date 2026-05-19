# Mirror Protocol

**Slash-bonded social trading with autonomous risk supervision, settled on Arc.**

Mirror is the answer to Research #6 of the Agora Agents Hackathon: a USDC performance bond on Arc that lets followers stake alongside a Hyperliquid leader, with an autonomous AI supervisor that slashes the bond when the leader's risk profile blows up — settled in under a second on Arc, paid back to followers in USDC.

> *"Copy-trading with skin in the game on the leader, not just the follower."*

---

## Submission at a glance

| | |
|---|---|
| **RFB fit** | RFB 06 — Social Trading Intelligence |
| **Research item** | #6 — Slash-bonded leaderboard copy-trading |
| **Live agent** | Autonomous, signs every tx via Circle Developer-Controlled Wallet, runs on a 15-second loop |
| **Circle tools used** | Developer-Controlled Wallets, USDC, USYC, Contracts (Arc) |
| **Settlement** | Arc testnet (chain `5042002`), sub-second finality |
| **Tests** | 17/17 pass against real Arc + real Circle + real Hyperliquid |
| **Repo** | https://github.com/aliveevie/mirror |

---

## The 30-second pitch

A Hyperliquid leader posts a USDC bond on Arc; followers deposit and have their capital mirrored at a fraction of the leader's exposure. An AI supervisor (running 24/7, signing via Circle) reads the leader's real-time HL telemetry — drawdown, leverage, position concentration, correlation drift — and trips an on-chain hysteresis FSM: `NORMAL → WATCH → ALERT → SLASHING → COOLDOWN`. If the leader actually blows up, the bond is slashed and proceeds are paid to follower rebates. Every supervisor decision commits a content-addressed reasoning artifact hash on-chain, so the *why* is auditable forever.

This is genuinely autonomous, not "AI-flavored automation": the agent decides when to evaluate, which features matter for the current market regime, what decision the policy returns, signs the transaction itself, and commits it on-chain — with zero human in the loop per tick.

---

## Architecture

```
                        Hyperliquid testnet
                                │
                                │  /info  (real telemetry: equity, positions, fills, funding)
                                ▼
                ┌───────────────────────────────────┐
                │   Mirror Supervisor (agent/)      │
                │   ─────────────────────────────   │
                │   1. pull leader telemetry        │
                │   2. classify market regime       │
                │   3. compute risk features        │
                │   4. policy.decide()              │
                │   5. build reasoning artifact     │
                │   6. content-address (keccak256)  │
                │   7. pin preimage to IPFS         │
                │   8. sign tx via Circle Wallet    │ ◀── encrypts entity secret RSA-OAEP-SHA256 per call
                └───────────────┬───────────────────┘
                                │
                                │  evaluate(leader, telemetry, artifactHash)
                                ▼
                ┌───────────────────────────────────┐
                │   Arc testnet (chain 5042002)     │
                │   ─────────────────────────────   │
                │   LeaderRegistry      bonds       │
                │   RiskCircuitBreaker  FSM         │
                │   AllocationRouter    follower $  │
                │   BuilderFeeWrapper   HL trades   │
                │   IdleReserve         USYC park   │
                └───────────────────────────────────┘
                                ▲
                                │  follower deposit, leader bond, view state
                                │
                ┌───────────────────────────────────┐
                │   app/  (Vite + React + wagmi)    │
                └───────────────────────────────────┘
```

Four planes:

- **`contracts/`** — Settlement. 5 init-once-locked contracts (no proxy admin, no upgrade hatch). `LeaderRegistry`, `RiskCircuitBreaker`, `AllocationRouter`, `BuilderFeeWrapper`, `IdleReserve`.
- **`agent/`** — Supervision. TypeScript long-running loop with real venue connectors (no mocks); signs every Arc tx via a Circle Developer-Controlled Wallet.
- **`app/`** — Interface. Vite + React + wagmi/viem. Leader and follower flows read live chain state.
- **`packages/shared/`** — Schema. Zod-validated `ReasoningArtifact`, content-address hash function, contract ABIs, address resolver.

---

## Live on Arc testnet

Contracts (chain `5042002`, RPC `https://rpc.testnet.arc.network`):

| Contract | Address |
|---|---|
| LeaderRegistry | `0xf1559Cea926906329a063a071c5290C4a65A2806` |
| AllocationRouter | `0x95Aa364114033d1a72F15361321295c54cBacA10` |
| RiskCircuitBreaker | `0x4C329C3d68ef2c9510E249A8FF991EfbDf15F1b9` |
| BuilderFeeWrapper | `0xb3dD9713A8353eDA05F967a5154B8fCE6E5604C8` |
| IdleReserve | `0x41fBF4092Fee25632F368c35Bb88692568090490` |
| USDC | `0x3600000000000000000000000000000000000000` |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |

**Agent wallet** (Circle): `0xce61a403fc0155170258225669a78c86f7b2887c`

### Real on-chain evaluate transactions (signed by the Circle agent wallet)

| Tx | Block |
|---|---|
| `0x9cb35e86a91df3dae10c3d8e48028cbe80835d17be96cfa9c833de9209a410bc` | 43015471 |
| `0x9409388e4a5279413a563529a3012523f5d42b7a06e43a5a2fbb73765bfc28fc` | 43015471 |
| `0x2aeb5555f1cb41d4b0a2118a758a326d113d99bb2f41e6ebfa5746da0847383f` | 43016576 |
| `0x9e1a3112d559da61193677a8640ae19e63b46b3b8738f9ddcfd1f443c015efd2` | 43016576 |
| `0x06b4569da3b410b80ce25d98a9a3f3de3149491ea91cac3bd6c5b8887a646e0f` | 43016576 |

All `from: 0xCE61a403…F7b2887C` (Circle wallet), `to: 0x4C329C3d…BdF15F1b9` (RiskCircuitBreaker), `status: success`.

---

## Why Arc

Mirror's per-tick economics only close on Arc:

| | Arc testnet | Most EVM testnets |
|---|---|---|
| Settlement | Sub-second deterministic finality | 12s+ probabilistic |
| Gas | ~$0.01 paid in USDC | Volatile native token |
| Per-evaluate cost | ~$0.0007 | $0.05–$1.00 |

A 15-second supervisor loop over 30 days = ~172,800 evaluate calls. On Arc that's ~$120 in USDC; on most chains it would erode the bond entirely. **The slash-bond design literally doesn't work without Arc.**

---

## Quick start

```bash
# 1. Clone + Bun install (uses bunfig.toml's ignoreScripts=true; supply-chain safe)
git clone https://github.com/aliveevie/mirror && cd mirror
bun install

# 2. Apple-Silicon native-binary fix (one-time, see SETUP.md for why)
./scripts/setup-native-bins.sh

# 3. Foundry deps
git submodule update --init --recursive

# 4. Env — fill in your Circle credentials + a Hyperliquid testnet key
cp .env.example .env
cp app/.env.example app/.env

# 5. Compile + test
cd contracts && forge build && forge test && cd ..
bun run --filter '@mirror/agent' test

# 6. Run the agent
bun --filter '@mirror/agent' run start

# 7. Boot the UI
bun --filter '@mirror/app' run dev
# → http://localhost:5173/
```

For deploying your own copy of the contracts, see `scripts/deploy.sh`.

---

## How the AI agent makes decisions

The supervisor isn't a wrapper around an LLM. It's a deterministic, auditable decision pipeline whose every output is content-addressed and committed on-chain:

1. **Telemetry ingest** — `agent/src/venues/hyperliquid.ts` calls HL's public `/info` endpoint for `clearinghouseState`, `userFillsByTime`, and `metaAndAssetCtxs`. No fake data.
2. **Feature computation** — `agent/src/features.ts` derives 6 features in bps: realized drawdown, drawdown velocity, position concentration (Herfindahl), correlation drift (stddev of log-returns), current leverage, declared-max leverage.
3. **Regime classification** — `agent/src/regime.ts` reads market-wide HL stress (realized vol, funding dispersion, MAD-style correlation stress) and emits one of `CALM | NORMAL | STRESSED | CRISIS`.
4. **Policy decision** — `agent/src/policy.ts` chooses `HOLD | REWEIGHT | ROTATE_TO_USYC | SLASH` based on features × regime, with thresholds tightening as regime worsens.
5. **Reasoning artifact** — `agent/src/artifact.ts` builds a zod-validated record of *every input that fed the decision*, hashes it with keccak256, and pins the preimage to IPFS.
6. **On-chain commitment** — `agent/src/wallet.ts` re-encrypts the Circle entity secret with RSA-OAEP-SHA256 (fresh ciphertext per call, no replay), POSTs to Circle's `contractExecution`, polls until terminal state, returns the Arc txHash.

The on-chain `RiskCircuitBreaker.evaluate(leader, telemetry)` runs a hysteresis FSM with:
- Different enter/exit thresholds (3% / 1.5% for WATCH; 8% / 5% for ALERT)
- Minimum-watch-duration before ALERT can fire (1 hour)
- Oracle quorum gate (≥2 confirming oracles to escalate)
- Same-block trip-and-reset prevention

This is the **agency** the rubric asks about: the AI doesn't just push a button, it *decides under uncertainty* and the contract independently re-checks the decision against rules it doesn't trust the agent to enforce.

---

## Circle developer-platform usage

| Product | Where used | Why |
|---|---|---|
| **Developer-Controlled Wallets** | `agent/src/wallet.ts` | Agent never holds plaintext keys; entity secret is RSA-encrypted per request; recovery file stored offline |
| **USDC on Arc** | All bond, allocation, slash flows | Native settlement currency |
| **Contracts on Arc** | 5 deployed contracts | Sub-second finality, sub-cent fees |
| **USYC** | `IdleReserve.sol` + policy `ROTATE_TO_USYC` decision | Risk-off allocation for idle capital — the agent routes here in `STRESSED`/`CRISIS` regimes |
| **Paymaster** *(roadmap)* | Follower UX | Followers pay gas in USDC on follow/withdraw |
| **CCTP** *(roadmap)* | Follower onboarding | Bring USDC from any chain in a single click |

---

## Repository layout

```
contracts/        Foundry — 5 settlement contracts + Deploy script
agent/            TypeScript — supervisor loop + Circle wallet + HL connector
app/              Vite + React + wagmi — leader & follower UI
packages/shared/  Schemas, ABIs, address resolver
scripts/          Setup, deploy, demo helpers
```

---

## Security posture

- **Init-once pattern** — every contract has an `initWiring` callable exactly once by the deployer. After that, wiring is locked forever, same security guarantee as `immutable` without requiring deployer-nonce prediction.
- **Slash-only AGENT** — the Circle wallet can call `evaluate` and `executeSlash` but cannot withdraw funds. Spending paths are role-separated: TREASURY, REBATE_POOL, EXECUTOR.
- **Hysteresis** — single block cannot both trip and reset; ALERT requires accumulated WATCH evidence; SLASHING requires ≥2 confirming oracles.
- **Entity-secret encryption** — Circle's entity secret never leaves the agent in plaintext; re-encrypted per call under Circle's public RSA-4096 key.
- **No off-chain database** — all trust-critical state on Arc.
- **`bunfig.toml`** — `ignoreScripts=true` closes the npm postinstall supply-chain vector; `saveExact=true` writes exact versions.

---

## What's deliberately not here

- **No mocks anywhere.** Every test runs against real Arc + real Circle + real Hyperliquid.
- **No upgrade proxy.** If we ship a bug, we redeploy. No admin can mutate logic.
- **No off-chain database.** Reasoning artifacts are content-addressed; chain state is the database.

---

## Roadmap (the visible week ahead)

- [ ] Paymaster integration so followers pay gas in USDC
- [ ] CCTP integration so followers can come from any chain
- [ ] Full WATCH → ALERT → SLASHING → COOLDOWN demo with a real HL position taking real drawdown
- [ ] Filebase / Web3.Storage swap for Pinata
- [ ] Vercel deploy of the app

---

## License

MIT.
