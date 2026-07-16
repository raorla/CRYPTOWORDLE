import { MAX_GUESSES, WORD_LENGTH } from "../config.ts";
import type { AppState, Color } from "../state.ts";
import { events } from "./events.ts";

/**
 * Idempotent DOM rendering: the grid and keyboard are built once and then
 * mutated in place, so CSS animations (stamps, pops) survive re-renders.
 */

const SYMBOLS: Record<Color, string> = { 0: "×", 1: "≈", 2: "✓" };
const COLOR_NAMES: Record<Color, string> = { 0: "absent", 1: "present", 2: "correct" };

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "⏎zxcvbnm⌫"];

/** The sealed-vault lock, restored when a fresh round re-seals the word. */
const LOCK_SVG = `<svg class="seal-lock" viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 5a3 3 0 1 1 6 0v3H9V7Zm3 7a1.75 1.75 0 0 1 .9 3.25V19a.9.9 0 0 1-1.8 0v-1.75A1.75 1.75 0 0 1 12 14Z"></path></svg>`;

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export function buildGrid(root: HTMLElement): void {
  root.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement("div");
    row.className = "grid-row";
    row.setAttribute("role", "row");
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${r}-${c}`;
      tile.setAttribute("role", "gridcell");
      row.appendChild(tile);
    }
    root.appendChild(row);
  }

  events.on("tile-color", ({ guessIndex, tile, color }) => {
    // The visual row for a guess is its position within MY rows — resolved at
    // render time; here we stamp whichever tile shows it.
    const el = document.querySelector<HTMLElement>(
      `[data-guess-index="${guessIndex}"][data-col="${tile}"]`,
    );
    if (el) {
      applyTileColor(el, color);
      // (re)trigger the stamp-in animation
      el.classList.remove("stamp");
      void el.offsetWidth;
      el.classList.add("stamp");
    }
  });

  events.on("shake", () => {
    const state = lastState;
    if (!state) return;
    const row = document.querySelectorAll<HTMLElement>(".grid-row")[state.myRows.length];
    row?.classList.add("shake");
    window.setTimeout(() => row?.classList.remove("shake"), 500);
  });
}

function applyTileColor(el: HTMLElement, color: Color): void {
  el.classList.remove("c0", "c1", "c2", "pending", "typing");
  el.classList.add(`c${color}`);
  el.dataset.sym = SYMBOLS[color];
  const letter = el.textContent ?? "";
  el.setAttribute("aria-label", `${letter}: ${COLOR_NAMES[color]}`);
}

let lastState: AppState | null = null;

export function renderGrid(state: AppState): void {
  lastState = state;
  for (let r = 0; r < MAX_GUESSES; r++) {
    const guessRow = state.myRows[r];
    const isTypingRow = r === state.myRows.length;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const el = document.getElementById(`tile-${r}-${c}`)!;
      if (guessRow) {
        el.textContent = guessRow.letters[c].toUpperCase();
        el.dataset.guessIndex = String(guessRow.guessIndex);
        el.dataset.col = String(c);
        const color = guessRow.colors[c];
        if (color !== null) {
          // Late/refresh render (no stamp event in flight): set color directly.
          if (!el.classList.contains(`c${color}`)) applyTileColor(el, color);
          el.classList.toggle("winrow", guessRow.win === true && color === 2);
        } else {
          el.classList.remove("c0", "c1", "c2", "winrow", "stamp", "typing");
          el.classList.add("pending");
          delete el.dataset.sym;
          el.setAttribute("aria-label", `${guessRow.letters[c]}: decrypting`);
        }
      } else if (isTypingRow) {
        const letter = state.typed[c] ?? "";
        const had = el.textContent;
        el.textContent = letter.toUpperCase();
        el.className = "tile" + (letter ? " typing" : "");
        delete el.dataset.guessIndex;
        delete el.dataset.sym;
        if (letter && had !== letter.toUpperCase()) {
          // retrigger pop
          el.classList.remove("typing");
          void el.offsetWidth;
          el.classList.add("typing");
        }
        el.setAttribute("aria-label", letter ? `typed ${letter}` : "empty");
      } else {
        el.textContent = "";
        el.className = "tile";
        delete el.dataset.guessIndex;
        delete el.dataset.sym;
        el.setAttribute("aria-label", "empty");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

export function buildKeyboard(
  root: HTMLElement,
  onKey: (key: string) => void,
): void {
  root.innerHTML = "";
  for (const rowKeys of KEY_ROWS) {
    const row = document.createElement("div");
    row.className = "kb-row";
    for (const k of rowKeys) {
      const btn = document.createElement("button");
      const isEnter = k === "⏎";
      const isBack = k === "⌫";
      btn.className = "key" + (isEnter ? " key-enter" : isBack ? " key-back" : "");
      btn.textContent = isEnter ? "enter" : isBack ? "⌫" : k;
      btn.dataset.key = isEnter ? "Enter" : isBack ? "Backspace" : k;
      btn.setAttribute(
        "aria-label",
        isEnter ? "submit guess" : isBack ? "delete letter" : `letter ${k}`,
      );
      btn.addEventListener("click", () => onKey(btn.dataset.key!));
      row.appendChild(btn);
    }
    root.appendChild(row);
  }
}

export function renderKeyboard(state: AppState): void {
  document.querySelectorAll<HTMLElement>(".key").forEach((btn) => {
    const k = btn.dataset.key!;
    if (k.length !== 1) return;
    btn.classList.remove("c0", "c1", "c2");
    const color = state.keyboard[k];
    if (color !== undefined) btn.classList.add(`c${color}`);
  });
}

// ---------------------------------------------------------------------------
// Side panels (pot / ledger / seal) + status
// ---------------------------------------------------------------------------

export function renderBanner(state: AppState): void {
  const roundNo = document.getElementById("round-number")!;
  roundNo.textContent = state.round ? `№ ${state.round.id}` : "№ —";

  const pot = document.getElementById("pot-value")!;
  const guesses = document.getElementById("guesses-value")!;
  const yours = document.getElementById("yours-value")!;
  pot.textContent = state.round ? trimEth(state.round.pot) : "—";
  guesses.textContent = state.round ? String(state.round.guessCount) : "0";
  yours.innerHTML = `${state.myRows.length} <span class="of">of ${MAX_GUESSES}</span>`;

  const ring = document.getElementById("seal-ring")!;
  const inner = document.getElementById("seal-inner")!;
  const caption = document.getElementById("seal-caption")!;
  if (state.round?.revealedWord) {
    ring.classList.add("unsealed");
    caption.classList.add("unsealed");
    caption.textContent = `Unsealed — it was “${state.round.revealedWord.toUpperCase()}”`;
    if (!inner.querySelector(".seal-check")) {
      inner.innerHTML = `<span class="seal-check">✓</span>`;
    }
  } else {
    ring.classList.remove("unsealed");
    caption.classList.remove("unsealed");
    caption.textContent = "Word sealed in a TEE";
    if (!inner.querySelector(".seal-lock")) {
      inner.innerHTML = LOCK_SVG;
    }
  }
}

export function renderCountdown(state: AppState): void {
  const el = document.getElementById("countdown-value")!;
  if (!state.round) return;
  if (state.round.status !== 0) {
    el.textContent = state.round.status === 1 ? "settled" : "expired";
    return;
  }
  const seconds = Math.max(0, state.round.deadline - Math.floor(Date.now() / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  el.textContent =
    h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s).padStart(2, "0")}`;
}

const BUSY_PHASES = new Set(["sealing", "computing", "decrypting", "claiming"]);
const WON_PHASES = new Set(["won", "claiming", "paid"]);
const SETTLED_PHASES = new Set(["solved-by-other", "expired"]);

export function renderStatus(state: AppState): void {
  const line = document.getElementById("status-line")!;
  if (!state.statusNote) {
    line.hidden = true;
    return;
  }
  line.hidden = false;
  line.className =
    "status-line" +
    (WON_PHASES.has(state.phase) ? " is-won" : SETTLED_PHASES.has(state.phase) ? " is-settled" : "");
  line.innerHTML = "";
  if (BUSY_PHASES.has(state.phase)) {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    line.appendChild(spinner);
  }
  line.appendChild(document.createTextNode(state.statusNote));
}

let toastTimer: number | null = null;

export function showToast(message: string, isError = true): void {
  const toast = document.getElementById("toast")!;
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.hidden = false;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 2600);
}

function trimEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth >= 1 ? eth.toFixed(2) : eth.toPrecision(2).replace(/\.?0+$/, "");
}
