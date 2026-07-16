import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import {
  createWalletClient,
  http,
  publicActions,
  type Hex,
  type PublicActions,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";

/**
 * Shared plumbing for the Node-side scripts (deploy, round generator, sanity
 * check): env handling, viem + Nox handle clients, explicit gas budgets, and
 * a KMS-latency-aware retry wrapper.
 */

// ---------------------------------------------------------------------------
// Explicit gas budgets. Nox precompile calls CANNOT be estimated by wallets or
// RPCs (they mis-estimate to ~block gas limit, which Infura then rejects), so
// every Nox-touching write sets gas explicitly. Measured on the local Nox
// coprocessor (test/integration/gas-probe.test.ts): createRound 416k,
// guess 1.82M, claim 539k, revealExpired 518k — padded ~2× for Sepolia.
// ---------------------------------------------------------------------------
export const GAS = {
  createRound: 900_000n,
  guess: 4_000_000n,
  claim: 1_200_000n,
  revealExpired: 1_200_000n,
} as const;

export interface Deployment {
  chainId: number;
  address: Hex;
  deployBlock: number;
  txHash: Hex;
  deployedAt: string;
}

const DEPLOYMENT_PATH = new URL("../deployments/sepolia.json", import.meta.url);
const ARTIFACT_PATH = new URL(
  "../artifacts/contracts/CryptoWordle.sol/CryptoWordle.json",
  import.meta.url,
);

export function loadArtifact(): { abi: any; bytecode: Hex } {
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode };
}

export function saveDeployment(deployment: Deployment): void {
  mkdirSync(new URL("../deployments", import.meta.url), { recursive: true });
  writeFileSync(DEPLOYMENT_PATH, JSON.stringify(deployment, null, 2) + "\n");
}

export function loadDeployment(): Deployment {
  const override = process.env.CRYPTOWORDLE_ADDRESS;
  try {
    const deployment = JSON.parse(readFileSync(DEPLOYMENT_PATH, "utf8")) as Deployment;
    if (override) deployment.address = override as Hex;
    return deployment;
  } catch {
    if (override) {
      return {
        chainId: sepolia.id,
        address: override as Hex,
        deployBlock: 0,
        txHash: "0x" as Hex,
        deployedAt: "",
      };
    }
    throw new Error(
      "No deployments/sepolia.json found and CRYPTOWORDLE_ADDRESS is not set. " +
        "Run `npm run deploy:sepolia` first.",
    );
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} (see .env.example)`);
  }
  return value;
}

export type Client = WalletClient & PublicActions;

export function makeClient(): Client {
  const account = privateKeyToAccount(requireEnv("DEPLOYER_PRIVATE_KEY") as Hex);
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(requireEnv("SEPOLIA_RPC_URL")),
  }).extend(publicActions) as Client;
}

export async function makeHandleClient(client: Client) {
  // The handle SDK auto-resolves gateway/subgraph/NoxCompute for Sepolia
  // (chainId 11155111) — no manual config needed.
  return createViemHandleClient(client as any);
}

/**
 * Retries `fn` while the Nox coprocessor materializes a result ciphertext.
 * On Sepolia the KMS/gateway can answer "not yet computed" (404) for seconds
 * to minutes after the tx that produced the handle — that is normal, not an
 * error. Retries on ANY error by default because the SDK surfaces transient
 * gateway states in several shapes; genuinely fatal errors will exhaust the
 * attempts and be rethrown.
 */
export async function withKmsRetry<T>(
  label: string,
  fn: () => Promise<T>,
  { attempts = 24, delayMs = 5_000 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        `  [kms] ${label}: attempt ${i}/${attempts} not ready (${message.slice(0, 120)}) — retrying in ${delayMs / 1000}s`,
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/** letters "abcde" → [0,1,2,3,4] */
export function wordToLetters(word: string): [number, number, number, number, number] {
  if (!/^[a-z]{5}$/.test(word)) throw new Error(`Not a 5-letter word: ${word}`);
  return [...word].map((c) => c.charCodeAt(0) - 97) as [
    number,
    number,
    number,
    number,
    number,
  ];
}

export function lettersToWord(letters: readonly (number | bigint)[]): string {
  return letters.map((v) => String.fromCharCode(97 + Number(v))).join("");
}

/** Encrypts the 5 letters of `word` for `contract`. Plaintext never leaves scope. */
export async function encryptWord(
  handleClient: Awaited<ReturnType<typeof makeHandleClient>>,
  word: string,
  contract: Hex,
): Promise<{ handles: [Hex, Hex, Hex, Hex, Hex]; proofs: [Hex, Hex, Hex, Hex, Hex] }> {
  const handles: Hex[] = [];
  const proofs: Hex[] = [];
  for (const letter of wordToLetters(word)) {
    const enc = await handleClient.encryptInput(BigInt(letter), "uint256", contract);
    handles.push(enc.handle as Hex);
    proofs.push(enc.handleProof as Hex);
  }
  return {
    handles: handles as [Hex, Hex, Hex, Hex, Hex],
    proofs: proofs as [Hex, Hex, Hex, Hex, Hex],
  };
}
