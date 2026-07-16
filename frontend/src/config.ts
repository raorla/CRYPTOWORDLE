import deployment from "../../deployments/sepolia.json";
import { CRYPTOWORDLE_ABI } from "../../shared/abi.ts";

export const ABI = CRYPTOWORDLE_ABI;
export const CONTRACT_ADDRESS = deployment.address as `0x${string}`;
export const DEPLOY_BLOCK = BigInt(deployment.deployBlock);
export const CHAIN_ID = 11155111;

export const ETHERSCAN = "https://sepolia.etherscan.io";

/**
 * Explicit gas budgets — wallets cannot estimate Nox precompile calls
 * (MetaMask defaults to ~block gas limit, which RPCs reject). Measured on the
 * local Nox coprocessor and padded ~2×: guess is ~95 TEE ops ≈ 1.82M gas.
 */
export const GAS = {
  guess: 4_000_000n,
  claim: 1_200_000n,
} as const;

/** KMS decryption retry policy: colors materialize seconds after the tx. */
export const KMS_RETRY = { attempts: 40, delayMs: 3_000 } as const;

/** Round + guess polling cadence. */
export const POLL_MS = 12_000;

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";
