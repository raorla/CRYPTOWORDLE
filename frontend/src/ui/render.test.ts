import { beforeEach, describe, expect, it } from "vitest";
import type { AppState, Color, GuessRow, RoundView } from "../state.ts";
import {
  buildGrid,
  buildKeyboard,
  renderBanner,
  renderCountdown,
  renderGrid,
  renderKeyboard,
  renderStatus,
} from "./render.ts";

const base: AppState = {
  phase: "idle",
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

const guess = (letters: string, colors: (Color | null)[], win: boolean | null = null): GuessRow => ({
  letters,
  colors,
  guessIndex: 0,
  win,
  mine: true,
});

const round = (over: Partial<RoundView> = {}): RoundView => ({
  id: 42n,
  pot: 50_000_000_000_000_000n, // 0.05 ETH
  deadline: 0,
  status: 0,
  winner: "0x0000000000000000000000000000000000000000",
  guessCount: 9,
  revealedWord: null,
  ...over,
});

const tile = (r: number, c: number) => document.getElementById(`tile-${r}-${c}`)!;

beforeEach(() => {
  document.body.innerHTML = `
    <span id="round-number"></span>
    <div id="pot-value"></div><div id="guesses-value"></div><div id="yours-value"></div>
    <div id="countdown-value"></div>
    <div id="status-line" hidden></div>
    <div id="grid"></div>
    <div id="keyboard"></div>
    <div id="seal-ring"><div id="seal-inner"><svg class="seal-lock"></svg></div></div>
    <div id="seal-caption"></div>`;
  buildGrid(document.getElementById("grid")!);
  buildKeyboard(document.getElementById("keyboard")!, () => {});
});

describe("grid", () => {
  it("builds a 6×5 board", () => {
    expect(document.querySelectorAll("#grid .tile")).toHaveLength(30);
    expect(document.querySelectorAll("#grid .grid-row")).toHaveLength(6);
  });

  it("shows the current input in the typing row", () => {
    renderGrid({ ...base, typed: "cr" });
    expect(tile(0, 0).textContent).toBe("C");
    expect(tile(0, 0).classList.contains("typing")).toBe(true);
    expect(tile(0, 2).textContent).toBe("");
  });

  it("stamps colors and color-blind symbols onto a scored row", () => {
    renderGrid({ ...base, myRows: [guess("crane", [2, 1, 0, 2, 1])] });
    expect(tile(0, 0).classList.contains("c2")).toBe(true);
    expect(tile(0, 0).dataset.sym).toBe("✓");
    expect(tile(0, 2).classList.contains("c0")).toBe(true);
    expect(tile(0, 2).dataset.sym).toBe("×");
    expect(tile(0, 1).dataset.sym).toBe("≈");
  });

  it("marks a winning row for the green glow", () => {
    renderGrid({ ...base, myRows: [guess("vapor", [2, 2, 2, 2, 2], true)] });
    expect(tile(0, 0).classList.contains("winrow")).toBe(true);
  });

  it("shows the pending shimmer while colors decrypt", () => {
    renderGrid({ ...base, myRows: [guess("vapor", [null, null, null, null, null])] });
    expect(tile(0, 0).classList.contains("pending")).toBe(true);
    expect(tile(0, 0).classList.contains("c2")).toBe(false);
  });
});

describe("keyboard", () => {
  it("builds 26 letters plus enter and backspace", () => {
    expect(document.querySelectorAll("#keyboard .key")).toHaveLength(28);
    expect(document.querySelector(".key.key-enter")?.getAttribute("data-key")).toBe("Enter");
    expect(document.querySelector(".key.key-back")?.getAttribute("data-key")).toBe("Backspace");
  });

  it("colors keys from the keyboard map", () => {
    renderKeyboard({ ...base, keyboard: { a: 2, r: 1, x: 0 } });
    expect(document.querySelector('.key[data-key="a"]')?.classList.contains("c2")).toBe(true);
    expect(document.querySelector('.key[data-key="r"]')?.classList.contains("c1")).toBe(true);
    expect(document.querySelector('.key[data-key="x"]')?.classList.contains("c0")).toBe(true);
  });
});

describe("status line", () => {
  it("hides when there is no note and colors by phase when there is", () => {
    renderStatus({ ...base, statusNote: null });
    expect(document.getElementById("status-line")!.hidden).toBe(true);

    renderStatus({ ...base, phase: "won", statusNote: "All green" });
    const line = document.getElementById("status-line")!;
    expect(line.hidden).toBe(false);
    expect(line.classList.contains("is-won")).toBe(true);

    renderStatus({ ...base, phase: "decrypting", statusNote: "Decrypting…" });
    expect(document.querySelector("#status-line .spinner")).not.toBeNull();
  });
});

describe("side panels", () => {
  it("renders pot, guesses, round number and 'yours' count", () => {
    renderBanner({ ...base, round: round(), myRows: [guess("crane", [0, 0, 0, 0, 0])] });
    expect(document.getElementById("round-number")!.textContent).toBe("№ 42");
    expect(document.getElementById("pot-value")!.textContent).toBe("0.05");
    expect(document.getElementById("guesses-value")!.textContent).toBe("9");
    expect(document.getElementById("yours-value")!.textContent).toContain("1");
  });

  it("keeps the seal sealed while the round is live", () => {
    renderBanner({ ...base, round: round() });
    const ring = document.getElementById("seal-ring")!;
    expect(ring.classList.contains("unsealed")).toBe(false);
    expect(ring.querySelector(".seal-lock")).not.toBeNull();
  });

  it("unseals the seal and reveals the word once decrypted", () => {
    renderBanner({ ...base, round: round({ revealedWord: "vapor", status: 1 }) });
    const ring = document.getElementById("seal-ring")!;
    expect(ring.classList.contains("unsealed")).toBe(true);
    expect(ring.querySelector(".seal-check")).not.toBeNull();
    expect(document.getElementById("seal-caption")!.textContent).toContain("VAPOR");
  });

  it("shows 'settled' in the countdown for a finished round", () => {
    renderCountdown({ ...base, round: round({ status: 1 }) });
    expect(document.getElementById("countdown-value")!.textContent).toBe("settled");
    renderCountdown({ ...base, round: round({ status: 2 }) });
    expect(document.getElementById("countdown-value")!.textContent).toBe("expired");
  });
});
