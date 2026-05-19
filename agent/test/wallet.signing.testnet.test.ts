/**
 * Real Circle wallet signing test.
 *
 * Exercises `makeAgentWalletFromEnv()` against the live Circle API and the
 * live Arc testnet. Sends 1 micro-USDC (0.000001 USDC) from the agent wallet
 * back to the deployer to keep balance impact ~zero while still exercising:
 *   - fresh entitySecretCiphertext encryption per call
 *   - contractExecution submission
 *   - terminal-state polling
 *   - real on-chain txHash returned
 *
 * No mocks. Burns ~0.002 USDC of gas per run.
 *
 * Run:  bun test agent/test/wallet.signing.testnet.test.ts
 */
import { test, expect } from "bun:test";
import { encodeFunctionData, getAddress, parseAbi } from "viem";
import { makeAgentWalletFromEnv } from "../src/wallet.ts";

const USDC = "0x3600000000000000000000000000000000000000" as const;
const DEPLOYER = "0xACE91A3F253FdDba383E65a2bAd50ebB1A92E5b3" as const;

test("makeAgentWalletFromEnv: returns wallet bound to Circle address", () => {
  const w = makeAgentWalletFromEnv();
  expect(w.address.toLowerCase()).toBe(
    (process.env.CIRCLE_AGENT_WALLET_ADDRESS ?? "").toLowerCase(),
  );
});

test(
  "signAndSend: real USDC transfer (1 micro-USDC -> deployer) confirms on Arc",
  async () => {
    const w = makeAgentWalletFromEnv();
    const data = encodeFunctionData({
      abi: parseAbi(["function transfer(address,uint256)"]),
      functionName: "transfer",
      args: [DEPLOYER, 1n],
    });
    const txHash = await w.signAndSend({ to: USDC, data });

    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);

    // Verify the tx exists on-chain and succeeded.
    const receipt = await w.read.waitForTransactionReceipt({ hash: txHash });
    expect(receipt.status).toBe("success");
    expect(getAddress(receipt.from)).toBe(getAddress(w.address));
    expect(getAddress(receipt.to!)).toBe(getAddress(USDC));
    // One ERC20 Transfer log (USDC).
    expect(receipt.logs.length).toBeGreaterThanOrEqual(1);
  },
  60_000,
);
