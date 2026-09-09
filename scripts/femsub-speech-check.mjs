import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAddressTerm,
  adaptSpeechBubbleMessages,
  genderizeSpeechBubbleMessage,
} from "../src/lib/address-term.ts";
test("legacy address values remain compatible", () => {
  assert.equal(normalizeAddressTerm("girl"), "femsub");
  assert.equal(normalizeAddressTerm("boy"), "sub");
  assert.equal(normalizeAddressTerm(null), "sub");
});
test("existing speech adapts to the selected address", () => {
  assert.equal(genderizeSpeechBubbleMessage("Good boy", "femsub"), "Good girl");
  assert.equal(genderizeSpeechBubbleMessage("Good boy", "sub"), "Good boy");
  assert.deepEqual(
    adaptSpeechBubbleMessages(
      ["Good boy", "Your chastity cage", "A gift for me"],
      "femsub",
    ),
    ["Good girl", "A gift for me"],
  );
});
