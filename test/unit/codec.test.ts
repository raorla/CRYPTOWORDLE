import { test } from "node:test";
import assert from "node:assert/strict";
import { lettersToWord, wordToLetters } from "../../service/common.ts";

test("wordToLetters encodes a→0 … z→25", () => {
  assert.deepEqual(wordToLetters("abcde"), [0, 1, 2, 3, 4]);
  assert.deepEqual(wordToLetters("vapor"), [21, 0, 15, 14, 17]);
});

test("lettersToWord is the inverse of wordToLetters", () => {
  for (const w of ["vapor", "crane", "fuzzy", "abbey"]) {
    assert.equal(lettersToWord(wordToLetters(w)), w);
  }
});

test("lettersToWord accepts bigint letters (as returned from chain reads)", () => {
  assert.equal(lettersToWord([21n, 0n, 15n, 14n, 17n]), "vapor");
});

test("wordToLetters rejects anything that is not five lowercase letters", () => {
  assert.throws(() => wordToLetters("abcd"));
  assert.throws(() => wordToLetters("abcdef"));
  assert.throws(() => wordToLetters("ABCDE"));
  assert.throws(() => wordToLetters("12345"));
  assert.throws(() => wordToLetters("ab de"));
});
