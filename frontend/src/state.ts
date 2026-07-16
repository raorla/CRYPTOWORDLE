/** A minimal observable store — enough reactivity for one game screen. */

export type Color = 0 | 1 | 2; // gray | yellow | green
export type TileState = Color | "pending" | "empty" | "typing";

export interface GuessRow {
  letters: string; // "kebab"
  colors: (Color | null)[]; // null while decrypting
  guessIndex: number;
  win: boolean | null;
  mine: boolean;
}

export type Phase =
  | "boot" // loading round data
  | "no-wallet" // read-only, wallet not connected
  | "idle" // connected, can type
  | "sealing" // guess tx signing/sending
  | "computing" // tx mined, TEE computing hints
  | "decrypting" // KMS decryption of colors in progress
  | "won" // this player found the word
  | "claiming" // claim tx in flight
  | "paid" // pot received
  | "spectator" // out of guesses, round still open
  | "solved-by-other"
  | "expired";

export interface RoundView {
  id: bigint;
  pot: bigint;
  deadline: number; // unix seconds
  status: 0 | 1 | 2;
  winner: `0x${string}`;
  guessCount: number;
  revealedWord: string | null;
}

export interface AppState {
  phase: Phase;
  account: `0x${string}` | null;
  /** On-chain house bankroll in wei; null when unknown/unsupported. */
  treasuryWei: bigint | null;
  round: RoundView | null;
  myRows: GuessRow[]; // this player's guesses in the current round
  othersCount: number; // guesses by other players
  typed: string; // current input row
  keyboard: Record<string, Color>; // best-known color per letter
  statusNote: string | null; // human-readable async state line
  error: string | null;
}

type Listener = (state: AppState) => void;

const state: AppState = {
  phase: "boot",
  account: null,
  treasuryWei: null,
  round: null,
  myRows: [],
  othersCount: 0,
  typed: "",
  keyboard: {},
  statusNote: null,
  error: null,
};

const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function update(patch: Partial<AppState>): void {
  Object.assign(state, patch);
  for (const listener of listeners) listener(state);
}

/** Merge a row's colors into the keyboard map (green beats yellow beats gray). */
export function absorbIntoKeyboard(row: GuessRow): void {
  const kb = { ...state.keyboard };
  row.colors.forEach((color, i) => {
    if (color === null) return;
    const letter = row.letters[i];
    const existing = kb[letter];
    if (existing === undefined || color > existing) kb[letter] = color;
  });
  update({ keyboard: kb });
}
