import { formatEther, type Hex } from "viem";
import { publicClient } from "./chain.ts";
import { ABI, CONTRACT_ADDRESS } from "./config.ts";

/**
 * Hall-of-records data layer. Everything comes from view functions — public
 * RPCs cap eth_getLogs ranges, so the archive is built by iterating
 * getRound(0..roundCount-1) in ONE multicall (Sepolia has multicall3; viem
 * batches and falls back to sequential eth_call where unsupported).
 */

export interface RoundSummary {
  id: bigint;
  status: 0 | 1 | 2; // Open | Solved | Expired
  pot: bigint;
  deadline: number; // unix seconds
  winner: Hex; // zero address unless Solved
  guessCount: number;
}

export interface Champion {
  address: Hex;
  wins: number;
  /** Most recent round this address won (ranking tiebreaker). */
  lastWinRound: bigint;
}

export interface Records {
  rounds: RoundSummary[]; // newest first
  champions: Champion[]; // ranked: wins desc, then most recent win first
  /** ETH currently escrowed in OPEN pots. The contract zeroes a round's pot
   *  when it settles (claim/revealExpired), so paid-out amounts are not
   *  recoverable from view functions — never display a fake total. */
  openPotWei: bigint;
  solvedCount: number;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
/** Archive cap — far above anything this hackathon deploy will reach. */
const MAX_ROUNDS = 300;

/** Pure aggregation, unit-testable without a chain. */
export function aggregateRecords(rounds: RoundSummary[]): Records {
  const byWinner = new Map<string, Champion>();
  let openPotWei = 0n;
  let solvedCount = 0;

  for (const round of rounds) {
    if (round.status === 0) {
      openPotWei += round.pot;
      continue;
    }
    if (round.status !== 1 || round.winner.toLowerCase() === ZERO_ADDR) continue;
    solvedCount++;
    const key = round.winner.toLowerCase();
    const entry =
      byWinner.get(key) ?? { address: round.winner, wins: 0, lastWinRound: round.id };
    entry.wins++;
    if (round.id > entry.lastWinRound) entry.lastWinRound = round.id;
    byWinner.set(key, entry);
  }

  const champions = [...byWinner.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      (b.lastWinRound > a.lastWinRound ? 1 : b.lastWinRound < a.lastWinRound ? -1 : 0),
  );

  return {
    rounds: [...rounds].sort((a, b) => (b.id > a.id ? 1 : -1)),
    champions,
    openPotWei,
    solvedCount,
  };
}

let cache: { at: number; data: Records } | null = null;
const CACHE_MS = 30_000;

/** Drops the cache. Called on round transitions (settle / new round) so a
 *  reopened Hall of Records never shows a just-settled round as still Open. */
export function invalidateRecords(): void {
  cache = null;
}

/** Fetches and aggregates the full round archive (30s cache). */
export async function fetchRecords(force = false): Promise<Records> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const count = Number(
    await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "roundCount",
    }),
  );

  const from = Math.max(0, count - MAX_ROUNDS);
  const ids = Array.from({ length: count - from }, (_, i) => BigInt(from + i));

  const results =
    ids.length === 0
      ? []
      : await publicClient.multicall({
          contracts: ids.map((id) => ({
            address: CONTRACT_ADDRESS,
            abi: ABI as any,
            functionName: "getRound",
            args: [id],
          })),
          allowFailure: false,
        });

  const rounds: RoundSummary[] = results.map((r: any, i) => {
    // getRound -> (creator, pot, deadline, status, winner, guessCount, revealedLetterHandles)
    const [, pot, deadline, status, winner, guessCount] = r as any[];
    return {
      id: ids[i],
      status: Number(status) as 0 | 1 | 2,
      pot: BigInt(pot),
      deadline: Number(deadline),
      winner: winner as Hex,
      guessCount: Number(guessCount),
    };
  });

  const data = aggregateRecords(rounds);
  cache = { at: Date.now(), data };
  return data;
}

/** The five sealed secret-letter handles of a round (opaque bytes32 pointers). */
export async function fetchSecretHandles(roundId: bigint): Promise<Hex[]> {
  const handles = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getSecretHandles",
    args: [roundId],
  })) as readonly Hex[];
  return [...handles];
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHandle(handle: string): string {
  return `${handle.slice(0, 10)}…${handle.slice(-6)}`;
}

export function ethLabel(wei: bigint): string {
  const eth = formatEther(wei);
  // trim trailing zeros but keep at least one decimal digit's worth of meaning
  return eth.includes(".") ? eth.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : eth;
}
