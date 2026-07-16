import { beforeEach, describe, expect, it } from "vitest";
import { absorbIntoKeyboard, getState, subscribe, update, type Color, type GuessRow } from "./state.ts";

const row = (letters: string, colors: (Color | null)[]): GuessRow => ({
  letters,
  colors,
  guessIndex: 0,
  win: null,
  mine: true,
});

beforeEach(() => {
  update({ keyboard: {}, myRows: [], typed: "", statusNote: null, error: null });
});

describe("absorbIntoKeyboard", () => {
  it("records the best-known color per letter, skipping undecrypted tiles", () => {
    absorbIntoKeyboard(row("crane", [2, 1, 0, null, 2]));
    expect(getState().keyboard).toEqual({ c: 2, r: 1, a: 0, e: 2 });
  });

  it("upgrades toward green but never downgrades (green > yellow > gray)", () => {
    // 'a' appears as gray, yellow, green across one row → best (green) wins.
    absorbIntoKeyboard(row("aaaaa", [0, 1, 2, null, 1]));
    expect(getState().keyboard.a).toBe(2);
    // A later all-gray row must not downgrade the known letters.
    absorbIntoKeyboard(row("aabcd", [0, 0, 0, 0, 0]));
    expect(getState().keyboard.a).toBe(2); // stays green
    expect(getState().keyboard.b).toBe(0);
  });
});

describe("store", () => {
  it("exposes the latest state and notifies subscribers on update", () => {
    let calls = 0;
    const unsub = subscribe(() => calls++);
    const before = calls; // subscribe fires once immediately
    update({ typed: "vapor" });
    expect(getState().typed).toBe("vapor");
    expect(calls).toBe(before + 1);
    unsub();
    update({ typed: "" });
    expect(calls).toBe(before + 1); // no longer notified after unsubscribe
  });
});
