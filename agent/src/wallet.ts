import {
  createPublicClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { ARC_TESTNET } from "@mirror/shared";
import { publicEncrypt, constants as cryptoConstants, randomUUID } from "node:crypto";

/**
 * Agent wallet adapter backed by a Circle Developer-Controlled Wallet.
 *
 * Signing path: every `signAndSend` posts to Circle's contractExecution
 * endpoint. Each call re-encrypts the 32-byte entity secret under Circle's
 * account-scoped RSA-OAEP-SHA256 public key (Circle rejects reused
 * ciphertexts). After acceptance, the tx is polled to completion and the
 * Arc testnet txHash is returned.
 *
 * The Circle entity secret never touches Circle's servers in plaintext; it
 * lives in the agent's environment as `CIRCLE_ENTITY_SECRET` (32-byte hex).
 */
export interface AgentWallet {
  address: Address;
  read: PublicClient;
  signAndSend(call: { to: Address; data: Hex; value?: bigint }): Promise<Hex>;
}

const CIRCLE_BASE = "https://api.circle.com/v1/w3s";
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40;

let cachedPublicKeyPem: string | null = null;

async function getCirclePublicKey(apiKey: string): Promise<string> {
  if (cachedPublicKeyPem) return cachedPublicKeyPem;
  const res = await fetch(`${CIRCLE_BASE}/config/entity/publicKey`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Circle publicKey fetch failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: { publicKey?: string } };
  const pem = body.data?.publicKey;
  if (!pem) throw new Error(`Circle publicKey response missing data.publicKey: ${JSON.stringify(body)}`);
  cachedPublicKeyPem = pem;
  return pem;
}

function encryptEntitySecret(entitySecretHex: string, publicKeyPem: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(entitySecretHex)) {
    throw new Error("CIRCLE_ENTITY_SECRET must be 64 hex chars (32 bytes)");
  }
  const plaintext = Buffer.from(entitySecretHex, "hex");
  const ciphertext = publicEncrypt(
    {
      key: publicKeyPem,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    plaintext,
  );
  return ciphertext.toString("base64");
}

interface CircleTxRecord {
  id: string;
  state: string;
  txHash?: Hex;
  errorReason?: string;
  errorDetails?: string;
}

async function pollUntilTerminal(apiKey: string, id: string): Promise<CircleTxRecord> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const res = await fetch(`${CIRCLE_BASE}/transactions/${id}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Circle GET tx ${id} failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { data?: { transaction?: CircleTxRecord } };
    const tx = body.data?.transaction;
    if (!tx) throw new Error(`Circle GET tx ${id} missing data.transaction`);
    if (["COMPLETE", "CONFIRMED", "FAILED", "DENIED", "CANCELED"].includes(tx.state)) {
      return tx;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Circle tx ${id} did not reach terminal state within ${POLL_MAX_ATTEMPTS} polls`);
}

export function makeAgentWalletFromEnv(): AgentWallet {
  const rpcUrl = process.env.ARC_RPC_URL ?? ARC_TESTNET.rpcUrl;
  const read = createPublicClient({ transport: http(rpcUrl), chain: undefined });

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletId = process.env.CIRCLE_AGENT_WALLET_ID;
  const walletAddr = process.env.CIRCLE_AGENT_WALLET_ADDRESS as Address | undefined;
  if (!apiKey || !entitySecret || !walletId || !walletAddr) {
    throw new Error(
      "Required Circle env: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_AGENT_WALLET_ID, CIRCLE_AGENT_WALLET_ADDRESS",
    );
  }

  return {
    address: walletAddr,
    read,
    async signAndSend(call) {
      const pem = await getCirclePublicKey(apiKey);
      const entitySecretCiphertext = encryptEntitySecret(entitySecret, pem);
      const body = {
        walletId,
        contractAddress: call.to,
        callData: call.data,
        ...(call.value ? { amount: call.value.toString() } : {}),
        feeLevel: "MEDIUM",
        idempotencyKey: randomUUID(),
        entitySecretCiphertext,
      };
      const res = await fetch(`${CIRCLE_BASE}/developer/transactions/contractExecution`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Circle contractExecution failed: ${res.status} ${await res.text()}`);
      }
      const submit = (await res.json()) as { data?: { id?: string } };
      const id = submit.data?.id;
      if (!id) throw new Error(`Circle contractExecution missing data.id: ${JSON.stringify(submit)}`);

      const tx = await pollUntilTerminal(apiKey, id);
      if (tx.state === "FAILED" || tx.state === "DENIED" || tx.state === "CANCELED") {
        throw new Error(`Circle tx ${id} ${tx.state}: ${tx.errorReason ?? ""} ${tx.errorDetails ?? ""}`);
      }
      if (!tx.txHash) throw new Error(`Circle tx ${id} ${tx.state} but no txHash`);
      return tx.txHash;
    },
  };
}
