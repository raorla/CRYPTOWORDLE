import { createViemHandleClient } from "@iexec-nox/handle";
import type { Hex } from "viem";
import { KMS_RETRY } from "./config.ts";
import { getWalletClient } from "./chain.ts";

/**
 * Nox handle-client glue. The player only ever needs `publicDecrypt` — colors
 * and win flags are PUBLICLY decryptable results, so there are no ACL
 * signatures and no MetaMask popups for reading hints. The client
 * auto-configures gateway/subgraph/NoxCompute for Sepolia (chainId 11155111).
 */

type HandleClient = Awaited<ReturnType<typeof createViemHandleClient>>;

let clientPromise: Promise<HandleClient> | null = null;

export function getHandleClient(): Promise<HandleClient> {
  if (!clientPromise) {
    clientPromise = createViemHandleClient(getWalletClient() as any).catch((error) => {
      clientPromise = null; // never cache a failed init
      throw error;
    });
  }
  return clientPromise;
}

export function resetHandleClient(): void {
  clientPromise = null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * publicDecrypt with KMS-latency patience: results materialize a few seconds
 * (occasionally minutes) after the tx that produced them. "Not yet computed"
 * is a normal state, not an error — retry with steady backoff.
 */
export async function publicDecryptWithRetry(
  handle: Hex,
  onRetry?: (attempt: number) => void,
): Promise<{ value: boolean | bigint; decryptionProof: Hex }> {
  const client = await getHandleClient();
  let lastError: unknown;
  for (let attempt = 1; attempt <= KMS_RETRY.attempts; attempt++) {
    try {
      const result = await client.publicDecrypt(handle as any);
      return {
        value: result.value as boolean | bigint,
        decryptionProof: result.decryptionProof as Hex,
      };
    } catch (error) {
      lastError = error;
      onRetry?.(attempt);
      await sleep(KMS_RETRY.delayMs);
    }
  }
  throw lastError;
}
