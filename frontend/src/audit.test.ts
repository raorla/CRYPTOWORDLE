import { describe, expect, it } from "vitest";
import { auditRows, scoreGuess } from "./audit.ts";
import type { Color } from "./state.ts";

describe("scoreGuess — contract replay semantics", () => {
  it("scores greens positionally", () => {
    expect(scoreGuess("vapor", "vapor")).toEqual([2, 2, 2, 2, 2]);
  });

  it("scores absent letters gray", () => {
    expect(scoreGuess("vapor", "melds")).toEqual([0, 0, 0, 0, 0]);
  });

  it("scores present-elsewhere letters yellow", () => {
    // v-a-p-o-r vs r-o-p-a-v: everything present, only p positional
    expect(scoreGuess("vapor", "ropav")).toEqual([1, 1, 2, 1, 1]);
  });

  it("pins the documented duplicate-letter simplification (kebab vs abbey)", () => {
    // Classic Wordle would gray the final b; the counting argument yellows it.
    // README: kebab vs abbey → ⬜🟨🟩🟨🟨
    expect(scoreGuess("abbey", "kebab")).toEqual([0, 1, 2, 1, 1]);
  });

  it("every duplicate of a present letter shows yellow", () => {
    // secret has one 'l'; both l's of "llama" light up (first is green)
    expect(scoreGuess("lapse", "llama")).toEqual([2, 1, 1, 0, 1]);
  });

  it("rejects malformed words", () => {
    expect(() => scoreGuess("abc", "vapor")).toThrow();
    expect(() => scoreGuess("vapor", "VAPOR")).toThrow();
  });
});

describe("auditRows — replaying a settled round", () => {
  const row = (letters: string, colors: (Color | null)[]) => ({ letters, colors });

  it("passes when every decrypted colour matches the replay", () => {
    const result = auditRows("vapor", [
      row("crane", scoreGuess("vapor", "crane")),
      row("ropav", [1, 1, 2, 1, 1]),
      row("vapor", [2, 2, 2, 2, 2]),
    ]);
    expect(result.honest).toBe(true);
    expect(result.checked).toBe(3);
    expect(result.colorsChecked).toBe(15);
    expect(result.mismatches).toEqual([]);
  });

  it("flags a forged colour", () => {
    const result = auditRows("vapor", [
      row("crane", [2, 0, 2, 0, 0]), // c is NOT green in vapor
    ]);
    expect(result.honest).toBe(false);
    expect(result.mismatches).toEqual([0]);
  });

  it("skips undecrypted colours and fully-pending rows", () => {
    const result = auditRows("vapor", [
      row("crane", [null, null, null, null, null]),
      row("ropav", [1, null, 2, null, 1]),
    ]);
    expect(result.checked).toBe(1);
    expect(result.colorsChecked).toBe(3);
    expect(result.honest).toBe(true);
  });

  it("handles an empty board (spectator who never guessed)", () => {
    const result = auditRows("vapor", []);
    expect(result.checked).toBe(0);
    expect(result.honest).toBe(true);
  });
});
