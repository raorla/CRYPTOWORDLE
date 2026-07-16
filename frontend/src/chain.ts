import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  publicActions,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";
import { ABI, CHAIN_ID, CONTRACT_ADDRESS, GAS } from "./config.ts";

declare global {
  interface Window {
    ethereum?: any;
  }
}

/** Read path: injected provider when present, public RPC otherwise. */
export const publicClient: PublicClient = createPublicClient({
  chain: sepolia,
  transport: window.ethereum ? custom(window.ethereum) : http(),
});

let walletClient: (WalletClient & ReturnType<typeof publicActions>) | null = null;

export function hasWallet(): boolean {
  return Boolean(window.ethereum);
}

export function getWalletClient() {
  if (!walletClient) throw new Error("Wallet not connected");
  return walletClient;
}

/** Connects MetaMask and hops to Sepolia if the wallet is elsewhere. */
export async function connectWallet(): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error("No wallet found — install MetaMask.");

  const client = createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  }).extend(publicActions);

  const [account] = await client.requestAddresses();

  const chainId = await client.getChainId();
  if (chainId !== CHAIN_ID) {
    try {
      await client.switchChain({ id: CHAIN_ID });
    } catch (error: any) {
      // 4902 — chain not added to the wallet yet.
      if (error?.code === 4902 || `${error?.message}`.includes("4902")) {
        await client.addChain({ chain: sepolia });
        await client.switchChain({ id: CHAIN_ID });
      } else {
        throw error;
      }
    }
  }

  walletClient = client as any;
  return account;
}

const contract = { address: CONTRACT_ADDRESS, abi: ABI } as const;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface RoundRaw {
  creator: Hex;
  pot: bigint;
  deadline: bigint;
  status: number;
  winner: Hex;
  guessCount: number;
  revealedLetterHandles: readonly Hex[];
}

export async function readRoundCount(): Promise<bigint> {
  return (await publicClient.readContract({
    ...contract,
    functionName: "roundCount",
  })) as bigint;
}

export async function readRound(roundId: bigint): Promise<RoundRaw> {
  const [creator, pot, deadline, status, winner, guessCount, revealedLetterHandles] =
    (await publicClient.readContract({
      ...contract,
      functionName: "getRound",
      args: [roundId],
    })) as unknown as any[];
  return { creator, pot, deadline, status, winner, guessCount, revealedLetterHandles };
}

export interface GuessRaw {
  player: Hex;
  timestamp: bigint;
  letters: readonly number[];
  colorHandles: readonly Hex[];
  winHandle: Hex;
}

export async function readGuesses(roundId: bigint): Promise<GuessRaw[]> {
  return (await publicClient.readContract({
    ...contract,
    functionName: "getGuesses",
    args: [roundId],
  })) as any[];
}

// ---------------------------------------------------------------------------
// Writes — always explicit gas (Nox calls are inestimable by wallets)
// ---------------------------------------------------------------------------

export async function sendGuess(roundId: bigint, letters: number[]): Promise<Hex> {
  const client = getWalletClient();
  const [account] = await client.getAddresses();
  return client.writeContract({
    ...contract,
    functionName: "guess",
    args: [roundId, letters as any],
    gas: GAS.guess,
    account,
    chain: sepolia,
  });
}

export async function sendClaim(
  roundId: bigint,
  guessIndex: bigint,
  decryptionProof: Hex,
): Promise<Hex> {
  const client = getWalletClient();
  const [account] = await client.getAddresses();
  return client.writeContract({
    ...contract,
    functionName: "claim",
    args: [roundId, guessIndex, decryptionProof],
    gas: GAS.claim,
    account,
    chain: sepolia,
  });
}

export async function waitForTx(hash: Hex) {
  return publicClient.waitForTransactionReceipt({ hash });
}
