#!/usr/bin/env bun
/**
 * Hyperliquid testnet trade driver.
 *
 * Signs EIP-712 actions for usdClassTransfer (spot → perps) and order
 * (open BTC perp position) using the HL wallet's private key. Submits to
 * the public Hyperliquid testnet exchange endpoint.
 *
 * This produces real on-venue telemetry that Mirror's supervisor reads
 * via the HL connector — enough for the FSM to potentially transition
 * if the position takes drawdown.
 *
 * Usage:
 *   bun scripts/hl-trade.ts transfer 5      # move 5 USDC spot → perps
 *   bun scripts/hl-trade.ts buy BTC 0.0001  # open a BTC perp long
 */
import { privateKeyToAccount } from "viem/accounts";

const HL_API = "https://api.hyperliquid-testnet.xyz";
const SIGNATURE_CHAIN_ID = 421614; // Arbitrum Sepolia
const HL_CHAIN = "Testnet";

const pk = process.env.HYPERLIQUID_TESTNET_WALLET
  ?? process.env.HYPERLIQUID_TESTNET_WALLET_PRIVATE_KEY;
if (!pk) {
  console.error("env HYPERLIQUID_TESTNET_WALLET (or _PRIVATE_KEY) required");
  process.exit(1);
}
const account = privateKeyToAccount((pk.startsWith("0x") ? pk : "0x" + pk) as `0x${string}`);
console.log("[hl] signing as", account.address);

const DOMAIN = {
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: SIGNATURE_CHAIN_ID,
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
} as const;

interface UsdClassTransfer {
  type: "usdClassTransfer";
  hyperliquidChain: string;
  signatureChainId: `0x${string}`;
  amount: string;
  toPerp: boolean;
  nonce: number;
}

async function userSignedAction(typeName: "UsdClassTransfer", action: UsdClassTransfer) {
  const types = {
    [`HyperliquidTransaction:${typeName}`]: [
      { name: "hyperliquidChain", type: "string" },
      { name: "amount", type: "string" },
      { name: "toPerp", type: "bool" },
      { name: "nonce", type: "uint64" },
    ],
  } as const;
  const sig = await account.signTypedData({
    domain: DOMAIN,
    types: types as never,
    primaryType: `HyperliquidTransaction:${typeName}` as never,
    message: {
      hyperliquidChain: action.hyperliquidChain,
      amount: action.amount,
      toPerp: action.toPerp,
      nonce: action.nonce,
    } as never,
  });
  // Split sig
  const r = sig.slice(0, 66) as `0x${string}`;
  const s = ("0x" + sig.slice(66, 130)) as `0x${string}`;
  const v = parseInt(sig.slice(130, 132), 16);
  return { r, s, v };
}

async function postExchange(body: unknown) {
  const res = await fetch(`${HL_API}/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log("[hl] exchange response:", JSON.stringify(json, null, 2));
  return json;
}

async function transferSpotToPerp(amount: string) {
  const nonce = Date.now();
  const action: UsdClassTransfer = {
    type: "usdClassTransfer",
    hyperliquidChain: HL_CHAIN,
    signatureChainId: `0x${SIGNATURE_CHAIN_ID.toString(16)}`,
    amount,
    toPerp: true,
    nonce,
  };
  const signature = await userSignedAction("UsdClassTransfer", action);
  return postExchange({ action, nonce, signature });
}

// --- L1 action signing (for orders) --------------------------------------
// HL L1 actions use a different scheme: an action hash signed as
// EIP-712 with domain { name: "Exchange", version: "1", chainId: 1337,
// verifyingContract: 0x000... }, and the message is { source: "a"/"b",
// connectionId: actionHash }.
import { encodeAbiParameters, keccak256, encodePacked, type Hex } from "viem";

interface LimitOrder {
  a: number;        // asset index
  b: boolean;       // isBuy
  p: string;        // limit price
  s: string;        // size
  r: boolean;       // reduceOnly
  t: { limit: { tif: "Gtc" | "Ioc" | "Alo" } };
}

async function placeOrder(asset: number, isBuy: boolean, price: string, size: string) {
  const nonce = Date.now();
  const order: LimitOrder = {
    a: asset,
    b: isBuy,
    p: price,
    s: size,
    r: false,
    t: { limit: { tif: "Ioc" } },
  };
  const action = {
    type: "order",
    orders: [order],
    grouping: "na",
  } as const;

  // L1 action signing — msgpack-encode the action, hash, sign with domain.
  // Since we don't have msgpack handy, use HL's JSON action-hash convention:
  // hash = keccak256(rlp(jsonStringified)) — actually the canonical is msgpack.
  // For testnet, the simpler /exchange endpoint also accepts EIP-712 user-signed
  // orders via the action variant. We'll use the official scheme via raw call.
  throw new Error(
    "L1 order signing needs msgpack — use the Python SDK or hyperliquid-rs.\n" +
    "For now we drove transfer only; positions need a separate signed-order tool.",
  );
}

// --- CLI ---------------------------------------------------------------
const cmd = process.argv[2];
const args = process.argv.slice(3);
if (cmd === "transfer") {
  const amount = args[0] ?? "1";
  console.log(`[hl] usdClassTransfer ${amount} USDC spot → perps`);
  await transferSpotToPerp(amount);
} else if (cmd === "buy") {
  const sym = args[0] ?? "BTC";
  const sz = args[1] ?? "0.0001";
  console.log(`[hl] order: BUY ${sz} ${sym}`);
  // Asset 0 is BTC by convention on HL testnet
  await placeOrder(0, true, "150000", sz);
} else {
  console.log("usage: bun scripts/hl-trade.ts transfer <USDC> | buy <SYM> <SIZE>");
}
