import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptSpeechBubbleMessages,
  genderizeSpeechBubbleMessage,
  isFemsubUserDirectedMaleMessage,
} from "../src/lib/address-term.ts";

test("rewrites safe user-directed male speech for femsubs", () => {
  const cases = [
    ["Good boy. Now send more.", "Good girl. Now send more."],
    ["You are my favorite boy.", "You are my favorite girl."],
    ["You're the best boyfriend ever.", "You're the best girlfriend ever."],
    ["My husband knows how to serve.", "My wife knows how to serve."],
    ["Such a pathetic beta.", "Such a pathetic bimbo."],
    ["You're not a man to me anymore.", "You're not a woman to me anymore."],
    ["A loyal dog knows when to pay his owner.", "A loyal dog knows when to pay her owner."],
  ];

  for (const [source, expected] of cases) {
    assert.equal(genderizeSpeechBubbleMessage(source, "femsub"), expected);
  }
});

test("does not blindly rewrite third-party male pronouns", () => {
  const source = "The boss wants his money. Do not make him wait.";
  assert.equal(genderizeSpeechBubbleMessage(source, "femsub"), source);
  assert.equal(isFemsubUserDirectedMaleMessage(source), false);
});

test("filters unsafe leftovers and male-anatomy-only lines from femsub pools", () => {
  const adapted = adaptSpeechBubbleMessages(
    [
      "Good boys go broke.",
      "You are my precious boy.",
      "Crush your balls for me.",
      "The boss wants his money.",
    ],
    "femsub",
  );

  assert.deepEqual(adapted, [
    "Good girls go broke.",
    "The boss wants his money.",
  ]);
  assert.equal(adapted.some(isFemsubUserDirectedMaleMessage), false);
});
