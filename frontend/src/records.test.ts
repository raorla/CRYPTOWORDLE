import { describe, expect, it, vi } from "vitest";
import {
  aggregateRecords,
  ethLabel,
  fetchRecords,
  invalidateRecords,
  shortAddress,
  shortHandle,
  type RoundSummary,
} from "./records.ts";

vi.mock("./chain.ts", () => ({
  publicClient: { readContract: vi.fn().mockResolvedValue(0n), multicall: vi.fn() },
}));

import { publicClient } from "./chain.ts";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const ALICE = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as const;
const BOB = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as const;

const round = (over: Partial<RoundSummary> & { id: bigint }): RoundSummary => ({
  status: 0,
  pot: 10_000_000_000_000_000n, // 0.01 ETH
  deadline: 0,
  winner: ZERO,
  guessCount: 0,
  ...over,
});

describe("aggregateRecords", () => {
  it("ranks champions by wins and tallies the live escrow", () => {
    // NOTE: the contract zeroes r.pot when a round settles, so solved rounds
    // arrive here with pot 0 — only OPEN pots are summable.
    const { champions, solvedCount, openPotWei } = aggregateRecords([
      round({ id: 0n, status: 1, winner: ALICE, pot: 0n }),
      round({ id: 1n, status: 1, winner: BOB, pot: 0n }),
      round({ id: 2n, status: 1, winner: ALICE, pot: 0n }),
      round({ id: 3n, status: 2, pot: 0n }), // expired — no winner
      round({ id: 4n, status: 0, pot: 10n }), // still open
      round({ id: 5n, status: 0, pot: 5n }), // still open
    ]);
    expect(champions.map((c) => c.address)).toEqual([ALICE, BOB]);
    expect(champions[0]).toMatchObject({ wins: 2, lastWinRound: 2n });
    expect(champions[1]).toMatchObject({ wins: 1, lastWinRound: 1n });
    expect(solvedCount).toBe(3);
    expect(openPotWei).toBe(15n);
  });

  it("breaks equal-wins ties by the most recent win", () => {
    const { champions } = aggregateRecords([
      round({ id: 0n, status: 1, winner: ALICE, pot: 0n }),
      round({ id: 1n, status: 1, winner: BOB, pot: 0n }),
    ]);
    expect(champions.map((c) => c.address)).toEqual([BOB, ALICE]);
  });

  it("merges the same winner across address casings", () => {
    const { champions } = aggregateRecords([
      round({ id: 0n, status: 1, winner: ALICE, pot: 0n }),
      round({ id: 1n, status: 1, winner: ALICE.toLowerCase() as any, pot: 0n }),
    ]);
    expect(champions).toHaveLength(1);
    expect(champions[0].wins).toBe(2);
    expect(champions[0].lastWinRound).toBe(1n);
  });

  it("orders the archive newest-first and handles the empty chain", () => {
    const { rounds } = aggregateRecords([round({ id: 0n }), round({ id: 2n }), round({ id: 1n })]);
    expect(rounds.map((r) => r.id)).toEqual([2n, 1n, 0n]);

    const empty = aggregateRecords([]);
    expect(empty.rounds).toEqual([]);
    expect(empty.champions).toEqual([]);
    expect(empty.openPotWei).toBe(0n);
  });
});

describe("fetchRecords cache", () => {
  it("serves from cache for 30s but refetches after invalidateRecords()", async () => {
    const read = vi.mocked(publicClient.readContract);
    read.mockClear();
    await fetchRecords();
    await fetchRecords();
    expect(read).toHaveBeenCalledTimes(1);

    // A round settled or a new one opened — the archive must be re-read.
    invalidateRecords();
    await fetchRecords();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("formatting helpers", () => {
  it("shortens addresses and handles", () => {
    expect(shortAddress(ALICE)).toBe("0xAAAA…AAAA");
    expect(shortHandle("0x" + "ab".repeat(32))).toBe("0xabababab…ababab");
  });

  it("renders wei as trimmed ETH", () => {
    expect(ethLabel(50_000_000_000_000_000n)).toBe("0.05");
    expect(ethLabel(1_000_000_000_000_000_000n)).toBe("1");
    expect(ethLabel(0n)).toBe("0");
  });
});
