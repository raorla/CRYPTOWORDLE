import { MAX_GUESSES, WORD_LENGTH } from "../config.ts";
import type { AppState, Color } from "../state.ts";
import { events } from "./events.ts";

/**
 * Idempotent DOM rendering: the grid and keyboard are built once and then
 * mutated in place, so CSS animations (flips, pops) survive re-renders.
 */

const SYMBOLS: Record<Color, string> = { 0: "×", 1: "≈", 2: "✓" };
const COLOR_NAMES: Record<Color, string> = { 0: "absent", 1: "present", 2: "correct" };

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "⏎zxcvbnm⌫"];

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
    // render time; here we just replay the flip on whichever tile shows it.
    const el = document.querySelector<HTMLElement>(
      `[data-guess-index="${guessIndex}"][data-col="${tile}"]`,
    );
    if (el) {
      el.classList.remove("pending");
      el.classList.add("flip");
      // color class applied mid-flip for the reveal effect
      window.setTimeout(() => applyTileColor(el, color), 270);
    }
  });

  events.on("shake", () => {
    const state = lastState;
    if (!state) return;
    const row = document.querySelectorAll<HTMLElement>(".grid-row")[state.myRows.length];
    row?.classList.add("shake");
    window.setTimeout(() => row?.classList.remove("shake"), 500);
  });

  events.on("win", ({ guessIndex }) => {
    const tiles = document.querySelectorAll<HTMLElement>(
      `[data-guess-index="${guessIndex}"]`,
    );
    tiles.forEach((t, i) =>
      window.setTimeout(() => t.classList.add("win-bounce"), i * 90),
    );
  });
}

function applyTileColor(el: HTMLElement, color: Color): void {
  el.classList.remove("c0", "c1", "c2", "pending");
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
        if (color !== null && !el.classList.contains(`c${color}`)) {
          // Refresh/late render (no flip event in flight): set color directly.
          if (!el.classList.contains("flip")) applyTileColor(el, color);
        } else if (color === null) {
          el.classList.add("pending");
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
      btn.className = "key" + (isEnter || isBack ? " wide" : "");
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
// Banner / status / toast
// ---------------------------------------------------------------------------

export function renderBanner(state: AppState): void {
  const banner = document.getElementById("round-banner")!;
  if (!state.round) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;

  const pot = document.getElementById("pot-value")!;
  pot.textContent = `${trimEth(state.round.pot)} ETH`;

  const guesses = document.getElementById("guesses-value")!;
  guesses.textContent = String(state.round.guessCount);

  const badge = document.getElementById("sealed-badge")!;
  const sealedText = document.getElementById("sealed-text")!;
  if (state.round.revealedWord) {
    badge.classList.add("unsealed");
    badge.querySelector(".lock-pulse")!.textContent = "🔓";
    sealedText.textContent = `it was “${state.round.revealedWord.toUpperCase()}”`;
  } else {
    badge.classList.remove("unsealed");
    badge.querySelector(".lock-pulse")!.textContent = "🔒";
    sealedText.textContent = "word sealed in a TEE";
  }
}

export function renderCountdown(state: AppState): void {
  const el = document.getElementById("countdown-value")!;
  if (!state.round) return;
  if (state.round.status !== 0) {
    el.textContent = state.round.status === 1 ? "solved" : "expired";
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

export function renderStatus(state: AppState): void {
  const pill = document.getElementById("status-pill")!;
  if (state.statusNote) {
    pill.hidden = false;
    pill.innerHTML = "";
    if (BUSY_PHASES.has(state.phase)) {
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      pill.appendChild(spinner);
    }
    pill.appendChild(document.createTextNode(state.statusNote));
  } else {
    pill.hidden = true;
  }
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
