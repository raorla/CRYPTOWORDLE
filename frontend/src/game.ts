import type { Hex } from "viem";
import { VALID_GUESSES } from "../../shared/words.ts";
import {
  readGuesses,
  readRound,
  readRoundCount,
  sendClaim,
  sendGuess,
  waitForTx,
  type GuessRaw,
} from "./chain.ts";
import { MAX_GUESSES, POLL_MS, WORD_LENGTH } from "./config.ts";
import { publicDecryptWithRetry } from "./nox.ts";
import {
  absorbIntoKeyboard,
  getState,
  update,
  type Color,
  type GuessRow,
  type RoundView,
} from "./state.ts";
import { events } from "./ui/events.ts";

const VALID = new Set(VALID_GUESSES);

const toLetters = (word: string) => [...word].map((c) => c.charCodeAt(0) - 97);
const toWord = (letters: readonly (number | bigint)[]) =>
  letters.map((v) => String.fromCharCode(97 + Number(v))).join("");

let currentRoundId: bigint | null = null;
let pollTimer: number | null = null;
/** Guess indexes whose colors we've already (started to) decrypt. */
const decrypted = new Set<string>();

// ---------------------------------------------------------------------------
// Round loading & polling
// ---------------------------------------------------------------------------

export async function loadLatestRound(): Promise<void> {
  const count = await readRoundCount();
  if (count === 0n) {
    update({ phase: "boot", statusNote: "No round yet — the vault is being prepared…" });
    return;
  }
  const roundId = count - 1n;
  const isNewRound = currentRoundId !== null && roundId !== currentRoundId;
  if (isNewRound) {
    decrypted.clear();
    // Reset the board AND the phase — otherwise a terminal phase from the
    // previous round (won/paid/spectator/expired/solved-by-other) would leave
    // canType() false and the player unable to guess in the new round.
    update({
      myRows: [],
      keyboard: {},
      typed: "",
      statusNote: null,
      phase: getState().account ? "idle" : "no-wallet",
    });
    events.emit("new-round");
  }
  currentRoundId = roundId;
  await refreshRound();
}

// Serialized so the 12s poll and the submit/claim flows never interleave their
// read+update passes (which race on myRows and phase). Each call runs strictly
// after any in-flight one, so a submit-triggered refresh always re-reads fresh
// state that includes the just-mined guess.
let refreshChain: Promise<void> = Promise.resolve();

function refreshRound(): Promise<void> {
  refreshChain = refreshChain.then(doRefresh, doRefresh);
  return refreshChain;
}

async function doRefresh(): Promise<void> {
  if (currentRoundId === null) return;
  const state = getState();
  const raw = await readRound(currentRoundId);

  const round: RoundView = {
    id: currentRoundId,
    pot: raw.pot,
    deadline: Number(raw.deadline),
    status: raw.status as 0 | 1 | 2,
    winner: raw.winner,
    guessCount: raw.guessCount,
    revealedWord: state.round?.id === currentRoundId ? state.round.revealedWord : null,
  };

  const guesses = await readGuesses(currentRoundId);
  const mine: GuessRow[] = [];
  let others = 0;
  guesses.forEach((g, i) => {
    if (state.account && g.player.toLowerCase() === state.account.toLowerCase()) {
      const existing = state.myRows.find((r) => r.guessIndex === i);
      mine.push(
        existing ?? {
          letters: toWord(g.letters),
          colors: [null, null, null, null, null],
          guessIndex: i,
          win: null,
          mine: true,
        },
      );
    } else {
      others++;
    }
  });

  update({ round, myRows: mine, othersCount: others });

  // Decrypt colors for any of my rows that don't have them yet (page refresh,
  // or guesses that were pending). Fire-and-forget per row.
  for (const row of mine) {
    if (row.colors.every((c) => c !== null)) continue;
    const key = `${currentRoundId}:${row.guessIndex}`;
    if (decrypted.has(key)) continue;
    decrypted.add(key);
    void decryptRow(guesses[row.guessIndex], row);
  }

  // Terminal states.
  if (round.status !== 0) {
    await onRoundSettled(round, guesses);
  } else if (
    state.account &&
    mine.length >= MAX_GUESSES &&
    getState().phase !== "won" &&
    getState().phase !== "paid"
  ) {
    update({
      phase: "spectator",
      statusNote: "Out of guesses — the word stays sealed while others play.",
    });
  } else if (state.account && getState().phase === "boot") {
    // First round loaded after connecting while none existed yet: leave the
    // "preparing the vault" boot phase so the player can actually type.
    update({ phase: "idle", statusNote: null });
  }
}

export function startPolling(): void {
  stopPolling();
  pollTimer = window.setInterval(() => {
    void loadLatestRound().catch(() => {});
  }, POLL_MS);
}

export function stopPolling(): void {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
}

// ---------------------------------------------------------------------------
// Color decryption
// ---------------------------------------------------------------------------

async function decryptRow(raw: GuessRaw, row: GuessRow): Promise<void> {
  try {
    // All five in parallel; each tile flips as its color lands.
    await Promise.all(
      raw.colorHandles.map(async (handle, i) => {
        const { value } = await publicDecryptWithRetry(handle as Hex);
        row.colors[i] = Number(value) as Color;
        events.emit("tile-color", { guessIndex: row.guessIndex, tile: i, color: row.colors[i]! });
        update({}); // re-render
      }),
    );
    absorbIntoKeyboard(row);

    const { value: win } = await publicDecryptWithRetry(raw.winHandle as Hex);
    row.win = win === true;
    update({});
    if (row.win && getState().phase !== "paid" && getState().phase !== "claiming") {
      update({ phase: "won", statusNote: "All green — the vault is yours. Claim the pot." });
      events.emit("win", { guessIndex: row.guessIndex });
    }
  } catch {
    // The KMS never materialised these colours (rare, transient). Don't wedge:
    // free the row so a later poll re-attempts, and release the input if the
    // submit flow is still parked in the "decrypting" phase waiting on it.
    decrypted.delete(`${currentRoundId}:${row.guessIndex}`);
    if (getState().phase === "decrypting") {
      update({
        phase: "idle",
        statusNote: null,
        error: "Colours are taking a while to decrypt — they'll appear shortly.",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Typing & submitting
// ---------------------------------------------------------------------------

export function typeLetter(letter: string): void {
  const s = getState();
  if (!canType(s.phase)) return;
  if (s.typed.length >= WORD_LENGTH) return;
  update({ typed: s.typed + letter, error: null });
  events.emit("key-tap");
}

export function backspace(): void {
  const s = getState();
  if (!canType(s.phase)) return;
  update({ typed: s.typed.slice(0, -1), error: null });
}

function canType(phase: string): boolean {
  return phase === "idle";
}

export async function submitGuess(): Promise<void> {
  const s = getState();
  if (!canType(s.phase) || !s.round || s.round.status !== 0) return;

  const word = s.typed;
  if (word.length !== WORD_LENGTH) {
    update({ error: "Five letters needed" });
    events.emit("shake");
    return;
  }
  if (!VALID.has(word)) {
    update({ error: `“${word.toUpperCase()}” isn't in the dictionary` });
    events.emit("shake");
    return;
  }
  if (s.round.deadline * 1000 < Date.now()) {
    update({ error: "Round deadline passed" });
    events.emit("shake");
    return;
  }

  try {
    update({ phase: "sealing", statusNote: "Sending your guess…", error: null });
    const hash = await sendGuess(s.round.id, toLetters(word));

    update({ phase: "computing", statusNote: "Computing hints on ciphertext in the TEE…" });
    const receipt = await waitForTx(hash);
    if (receipt.status !== "success") throw new Error("Guess transaction reverted");

    update({ typed: "", phase: "decrypting", statusNote: "Decrypting colours via the KMS…" });
    await refreshRound(); // picks up the new row and starts decrypting it

    // Back to idle once colors resolve (decryptRow flips phase on a win).
    const settle = window.setInterval(() => {
      const st = getState();
      const row = st.myRows.find((r) => r.letters === word && r.colors.every((c) => c !== null));
      if (row || st.phase !== "decrypting") {
        window.clearInterval(settle);
        if (getState().phase === "decrypting") {
          update({ phase: "idle", statusNote: null });
        }
      }
    }, 500);
  } catch (error: any) {
    const message = `${error?.shortMessage ?? error?.message ?? error}`;
    update({
      phase: "idle",
      statusNote: null,
      error: message.includes("User rejected") ? "Transaction cancelled" : message.slice(0, 140),
    });
  }
}

// ---------------------------------------------------------------------------
// Claiming
// ---------------------------------------------------------------------------

export async function claimPot(): Promise<void> {
  const s = getState();
  if (!s.round) return;
  const winningRow = s.myRows.find((r) => r.win === true);
  if (!winningRow) return;

  try {
    update({ phase: "claiming", statusNote: "Fetching the KMS proof…" });
    const guesses = await readGuesses(s.round.id);
    const raw = guesses[winningRow.guessIndex];
    const { value, decryptionProof } = await publicDecryptWithRetry(raw.winHandle as Hex);
    if (value !== true) throw new Error("Win handle did not decrypt to true");

    update({ statusNote: "Claiming the pot (proof verified on-chain)…" });
    const hash = await sendClaim(s.round.id, BigInt(winningRow.guessIndex), decryptionProof);
    const receipt = await waitForTx(hash);
    if (receipt.status !== "success") throw new Error("Claim transaction reverted");

    update({ phase: "paid", statusNote: "Pot paid out — revealing the word…" });
    events.emit("paid", { txHash: hash });
  } catch (error: any) {
    update({
      phase: "won",
      statusNote: "Claim failed — tap here to try again.",
      error: `${error?.shortMessage ?? error?.message ?? error}`.slice(0, 140),
    });
    return;
  }
  // The claim already succeeded; a failure fetching the reveal must NOT be
  // reported as a failed claim. The poll will retry the reveal.
  try {
    await refreshRound();
  } catch {
    /* reveal will surface on the next poll */
  }
}

// ---------------------------------------------------------------------------
// Settled rounds: reveal + verify
// ---------------------------------------------------------------------------

async function onRoundSettled(round: RoundView, guesses: GuessRaw[]): Promise<void> {
  const s = getState();
  const iWon =
    s.account !== null && round.winner.toLowerCase() === s.account.toLowerCase();

  if (!iWon && s.phase !== "solved-by-other" && s.phase !== "expired" && s.phase !== "paid") {
    update({
      phase: round.status === 1 ? "solved-by-other" : "expired",
      statusNote:
        round.status === 1
          ? "Someone cracked the vault! The word is being unsealed…"
          : "Round expired — unsealing the word…",
    });
  }

  // Decrypt the revealed secret exactly once per round. Needs the handle
  // client (wallet-backed) — spectators see the sealed badge until they connect.
  if (round.revealedWord === null && getState().account) {
    const raw = await readRound(round.id);
    const handles = raw.revealedLetterHandles.filter(
      (h) => h !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    if (handles.length === WORD_LENGTH) {
      const letters = await Promise.all(
        handles.map(async (h) => {
          const { value } = await publicDecryptWithRetry(h as Hex);
          return Number(value);
        }),
      );
      const revealedWord = toWord(letters);
      const phase = getState().phase;
      const settledNote =
        phase === "solved-by-other" || phase === "expired"
          ? "Round settled — the word is unsealed for audit."
          : getState().statusNote;
      update({ round: { ...getState().round!, revealedWord }, statusNote: settledNote });
      events.emit("revealed", { word: revealedWord, guesses });
    }
  }
}

// ---------------------------------------------------------------------------
// Share card
// ---------------------------------------------------------------------------

export function buildShareText(): string {
  const s = getState();
  const grid = s.myRows
    .map((row) =>
      row.colors.map((c) => (c === 2 ? "🟩" : c === 1 ? "🟨" : c === 0 ? "⬜" : "⬛")).join(""),
    )
    .join("\n");
  const tries = s.myRows.some((r) => r.win) ? `${s.myRows.length}/6` : "X/6";
  const pot = s.round ? `${Number(s.round.pot) / 1e18} ETH` : "";
  return (
    `CryptoWordle #${s.round?.id ?? "?"} — ${tries}\n\n${grid}\n\n` +
    `The word was sealed in a TEE 🔒 — even the server can't read it. ` +
    `Cracked on-chain for a ${pot} pot on @iEx_ec Nox.\n${location.origin}`
  );
}

export function shareOnX(): void {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText())}`;
  window.open(url, "_blank", "noopener");
}
