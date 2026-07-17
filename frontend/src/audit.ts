import type { Color, GuessRow } from "./state.ts";

/**
 * Client-side replay of the contract's on-ciphertext hint computation
 * (CryptoWordle.sol, guess()): once a round settles and the secret word is
 * unsealed, anyone can recompute every colour that was handed out during the
 * round and compare it with what the TEE actually returned. This is the
 * "provable fairness" pitch made executable in the browser.
 *
 * Exact contract semantics (including the documented duplicate-letter
 * simplification — Nox has no encrypted OR, so presence is a counting
 * argument):
 *   green  (2) ⇔ guess[i] == secret[i]
 *   yellow (1) ⇔ not green and guess[i] appears ANYWHERE in secret
 *   gray   (0) ⇔ otherwise
 * A row wins ⇔ colors sum to 10 (all green).
 */
export function scoreGuess(secret: string, guess: string): Color[] {
  if (!/^[a-z]{5}$/.test(secret) || !/^[a-z]{5}$/.test(guess)) {
    throw new Error(`scoreGuess expects two 5-letter lowercase words`);
  }
  return [...guess].map((letter, i) => {
    if (secret[i] === letter) return 2;
    return secret.includes(letter) ? 1 : 0;
  });
}

export interface AuditResult {
  /** Rows that had at least one decrypted colour to check. */
  checked: number;
  /** Total decrypted colours compared. */
  colorsChecked: number;
  /** True iff every decrypted colour matches the local replay. */
  honest: boolean;
  /** Row indexes (within the given list) whose colours diverged. */
  mismatches: number[];
}

/**
 * Replays every decrypted colour of `rows` against the unsealed `secret`.
 * Undecrypted colours (null) are skipped — they were never shown to the
 * player, so there is nothing to audit.
 */
export function auditRows(
  secret: string,
  rows: readonly Pick<GuessRow, "letters" | "colors">[],
): AuditResult {
  let checked = 0;
  let colorsChecked = 0;
  const mismatches: number[] = [];

  rows.forEach((row, index) => {
    const hasDecrypted = row.colors.some((c) => c !== null);
    if (!hasDecrypted) return;
    checked++;
    const expected = scoreGuess(secret, row.letters);
    let rowHonest = true;
    row.colors.forEach((c, i) => {
      if (c === null) return;
      colorsChecked++;
      if (c !== expected[i]) rowHonest = false;
    });
    if (!rowHonest) mismatches.push(index);
  });

  return { checked, colorsChecked, honest: mismatches.length === 0, mismatches };
}
