// Checks the avatar slot exclusion rules in src/lib/avatar-slots.ts.
//
//   npm run test:slots
//
// The rules that matter here are mutual: equipping A must drop B, AND equipping
// B must drop A. Enforcing only one direction leaves the conflict reachable by
// picking the items in the other order, which is invisible until someone does.

import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The module under test imports through the "@/..." alias, which Node does not
// know about - tsconfig paths are a TypeScript/bundler concept. Map it the same
// way tsconfig does so the REAL module can be loaded rather than a copy of its
// logic, which would drift.
const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    let target = resolvePath(ROOT, "src", specifier.slice(2));
    if (!/\.[a-z]+$/i.test(target)) target += ".ts";
    return nextResolve(pathToFileURL(target).href, context);
  },
});

const { equipAvatarItem, normalizeEquipment, ITEM_SLOT_MAP, getRenderedAvatarLayers } =
  await import("../src/lib/avatar-slots.ts");

// Stand-in ids so the check does not depend on the live catalogue.
const F = {
  TATTOO: "test_tattoo",
  FULL_LEGS: "test_thigh_boots",
  SHOES: "test_shoes",
  THIGHHIGHS: "test_thighhighs",
  LEGGINGS: "test_leggings",
  BOTTOM: "test_skirt",
  TOP: "test_top",
  FULL_BODY: "test_bodysuit",
};
ITEM_SLOT_MAP[F.TATTOO] = "tattoo";
ITEM_SLOT_MAP[F.FULL_LEGS] = "fullLegs";
ITEM_SLOT_MAP[F.SHOES] = "shoes";
ITEM_SLOT_MAP[F.THIGHHIGHS] = "thighhighs";
ITEM_SLOT_MAP[F.LEGGINGS] = "leggings";
ITEM_SLOT_MAP[F.BOTTOM] = "bottom";
ITEM_SLOT_MAP[F.TOP] = "top";
ITEM_SLOT_MAP[F.FULL_BODY] = "fullBody";

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures++;
    console.log(`  FAIL  ${name}\n          ${error.message}`);
  }
}

const equip = (start, ...ids) => ids.reduce((state, id) => equipAvatarItem(state, id), start);

// --- fullLegs and the three legwear slots, both directions -------------------
for (const [label, id] of [["shoes", F.SHOES], ["thighhighs", F.THIGHHIGHS], ["leggings", F.LEGGINGS]]) {
  check(`fullLegs clears ${label}`, () => {
    const result = equip({}, id, F.FULL_LEGS);
    assert.equal(result.fullLegs, F.FULL_LEGS);
    assert.equal(result[ITEM_SLOT_MAP[id]], undefined, `${label} survived`);
  });

  // The reverse order is the case a one-directional rule would miss.
  check(`${label} clears fullLegs`, () => {
    const result = equip({}, F.FULL_LEGS, id);
    assert.equal(result[ITEM_SLOT_MAP[id]], id);
    assert.equal(result.fullLegs, undefined, "fullLegs survived");
  });
}

// --- fullLegs is not leggings ------------------------------------------------
check("fullLegs keeps bottom (skirt over thigh boots)", () => {
  const result = equip({}, F.BOTTOM, F.FULL_LEGS);
  assert.equal(result.bottom, F.BOTTOM);
  assert.equal(result.fullLegs, F.FULL_LEGS);
});

check("leggings still clears bottom", () => {
  const result = equip({}, F.BOTTOM, F.LEGGINGS);
  assert.equal(result.bottom, undefined);
});

// --- tattoo conflicts with nothing -------------------------------------------
check("tattoo survives a full outfit", () => {
  const result = equip({}, F.TATTOO, F.TOP, F.BOTTOM, F.THIGHHIGHS, F.SHOES);
  assert.equal(result.tattoo, F.TATTOO);
});

check("tattoo survives fullBody", () => {
  const result = equip({}, F.TATTOO, F.FULL_BODY);
  assert.equal(result.tattoo, F.TATTOO);
  assert.equal(result.fullBody, F.FULL_BODY);
});

check("tattoo survives fullLegs", () => {
  const result = equip({}, F.TATTOO, F.FULL_LEGS);
  assert.equal(result.tattoo, F.TATTOO);
  assert.equal(result.fullLegs, F.FULL_LEGS);
});

// --- tattoo renders first, on the skin ---------------------------------------
check("tattoo is the bottom render layer", () => {
  const layers = getRenderedAvatarLayers(
    normalizeEquipment({ tattoo: F.TATTOO, top: F.TOP, bottom: F.BOTTOM, shoes: F.SHOES }),
  );
  assert.equal(layers[0]?.slot, "tattoo", `first layer was ${layers[0]?.slot}`);
});

// --- a conflict already saved in the database is repaired on read ------------
check("normalizeEquipment repairs a stored fullLegs conflict", () => {
  const result = normalizeEquipment({
    fullLegs: F.FULL_LEGS,
    shoes: F.SHOES,
    thighhighs: F.THIGHHIGHS,
    leggings: F.LEGGINGS,
  });
  assert.equal(result.fullLegs, F.FULL_LEGS);
  assert.equal(result.shoes, undefined);
  assert.equal(result.thighhighs, undefined);
  assert.equal(result.leggings, undefined);
});

console.log(`\n${failures === 0 ? "all passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
