import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWERS, VALID_GUESSES } from "../../shared/words.ts";

test("both lists are well-formed 5-letter lowercase words", () => {
  assert.equal(ANSWERS.length, 1500);
  assert.equal(VALID_GUESSES.length, 5757);
  assert.ok(ANSWERS.every((w) => /^[a-z]{5}$/.test(w)), "answers");
  assert.ok(VALID_GUESSES.every((w) => /^[a-z]{5}$/.test(w)), "guesses");
});

test("neither list contains duplicates", () => {
  assert.equal(new Set(ANSWERS).size, ANSWERS.length);
  assert.equal(new Set(VALID_GUESSES).size, VALID_GUESSES.length);
});

test("every answer is itself a valid guess (so the winning word can be typed)", () => {
  const guesses = new Set(VALID_GUESSES);
  const missing = ANSWERS.filter((a) => !guesses.has(a));
  assert.deepEqual(missing, [], `answers absent from VALID_GUESSES: ${missing.slice(0, 5).join(",")}`);
});
